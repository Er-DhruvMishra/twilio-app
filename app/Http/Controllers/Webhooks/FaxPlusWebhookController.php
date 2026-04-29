<?php

namespace App\Http\Controllers\Webhooks;

use App\Events\FaxReceived;
use App\Events\FaxStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Fax;
use App\Models\FaxConfig;
use App\Models\FaxDocument;
use App\Models\User;
use App\Notifications\IncomingFaxNotification;
use App\Services\Debug\DebugLogger;
use App\Services\Fax\FaxPlusService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FaxPlusWebhookController extends Controller
{
    public function __construct(private FaxPlusService $faxPlus) {}

    /** Outbound status callback: success / failed / cancelled. */
    public function status(Request $request)
    {
        $payload = $request->json()->all() ?: $request->all();
        DebugLogger::log('webhooks', 'POST /webhooks/faxplus/status', $payload);
        DebugLogger::log('fax', 'inbound webhook · status', $payload);
        $faxId = (string) ($payload['fax_id'] ?? $payload['id'] ?? '');
        if (!$faxId) return response('ok');

        $fax = Fax::where('fax_plus_id', $faxId)->first();
        if (!$fax) return response('ok');

        $status = self::mapStatus((string) ($payload['status'] ?? $payload['event'] ?? ''));
        $fax->update([
            'status' => $status,
            'num_pages' => (int) ($payload['pages'] ?? $fax->num_pages),
            'error_code' => $payload['error']['code'] ?? null,
            'error_message' => $payload['error']['message'] ?? null,
            'cost_cents' => isset($payload['cost']) ? (int) round(((float) $payload['cost']) * 100) : (int) $fax->cost_cents,
            'ended_at' => now(),
            'payload' => array_merge($fax->payload ?? [], $payload),
        ]);

        FaxStatusUpdated::dispatch($fax->fresh());

        return response('ok');
    }

    /** Inbound: a fax was received on our fax.plus number. Persist + cache PDF. */
    public function inbound(Request $request)
    {
        $payload = $request->json()->all() ?: $request->all();
        DebugLogger::log('webhooks', 'POST /webhooks/faxplus/inbound', $payload);
        DebugLogger::log('fax', 'inbound webhook · received', $payload);
        $faxId = (string) ($payload['fax_id'] ?? $payload['id'] ?? '');
        if (!$faxId) return response('ok');

        // Idempotent: ignore if we already have it.
        if (Fax::where('fax_plus_id', $faxId)->exists()) {
            return response('ok');
        }

        $config = FaxConfig::active();
        $owner = $config?->user_id ? User::find($config->user_id) : User::role('admin')->first();
        if (!$owner) return response('ok');

        $from = (string) ($payload['from'] ?? '');
        $to = (string) ($payload['to'] ?? $config?->from_number ?? '');
        $contactId = Contact::where('user_id', $owner->id)->where('phone_e164', $from)->value('id');

        $fax = Fax::create([
            'user_id' => $owner->id,
            'contact_id' => $contactId,
            'direction' => 'inbound',
            'from_e164' => $from,
            'to_e164' => $to,
            'num_pages' => (int) ($payload['pages'] ?? 0),
            'status' => 'success',
            'fax_plus_id' => $faxId,
            'started_at' => isset($payload['received_at']) ? \Carbon\Carbon::parse($payload['received_at']) : now(),
            'ended_at' => now(),
            'payload' => $payload,
        ]);

        // Cache the PDF locally so playback doesn't require a fax.plus round-trip.
        try {
            $bytes = $this->faxPlus->downloadPdf($faxId, 'inbox');
            $path = "faxes/inbound/{$faxId}.pdf";
            Storage::disk('local')->put($path, $bytes);
            $fax->update(['document_path' => $path]);
            FaxDocument::create([
                'fax_id' => $fax->id,
                'original_name' => "fax-{$faxId}.pdf",
                'local_path' => $path,
                'size_bytes' => strlen($bytes),
                'pages' => $fax->num_pages,
            ]);
        } catch (\Throwable) {
            // Non-fatal — pdf() endpoint will retry on demand.
        }

        $fresh = $fax->fresh();
        FaxReceived::dispatch($fresh);

        // Web Push fires after the response is sent so the webhook ack
        // latency clock isn't gated on Notification::send round-trips.
        if ($owner) {
            dispatch(function () use ($owner, $fresh) {
                $owner->notify(new IncomingFaxNotification($fresh));
            })->afterResponse();
        }

        return response('ok');
    }

    private static function mapStatus(string $s): string
    {
        $s = strtolower($s);
        if (str_contains($s, 'success') || str_contains($s, 'completed')) return 'success';
        if (str_contains($s, 'fail')) return 'failed';
        if (str_contains($s, 'cancel')) return 'canceled';
        if (str_contains($s, 'partial')) return 'partially_successful';
        if (str_contains($s, 'progress') || str_contains($s, 'process')) return 'in_progress';
        return 'queued';
    }
}
