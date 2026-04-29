<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Fax;
use App\Models\FaxDocument;
use App\Services\Fax\FaxPlusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FaxController extends Controller
{
    public function __construct(private FaxPlusService $faxPlus) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $direction = $request->query('direction'); // inbound|outbound|null

        $with = ['contact:id,display_name,phone_e164', 'documents:id,fax_id,original_name,pages,size_bytes'];
        if ($user->isAdmin()) $with[] = 'user:id,name';

        $query = Fax::with($with)->ownedBy($user)->orderByDesc('id');
        if ($direction) $query->where('direction', $direction);

        return response()->json([
            'faxes' => $query->limit(200)->get()->map(fn (Fax $f) => $this->transform($f, $user->isAdmin())),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $fax = Fax::with(['contact:id,display_name,phone_e164', 'documents'])
            ->ownedBy($user)
            ->findOrFail($id);

        if ($user->isAdmin() && $fax->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.fax.show', $fax, ['viewed_user_id' => $fax->user_id]);
        }

        $fax->update(['is_read' => true]);
        return response()->json(['fax' => $this->transform($fax, $user->isAdmin(), withDocuments: true)]);
    }

    public function send(Request $request): JsonResponse
    {
        $request->validate([
            'to' => ['required', 'string', 'starts_with:+', 'max:32'],
            'file' => ['required', 'file', 'mimes:pdf', 'max:30720'], // 30MB cap (fax.plus limit)
        ]);

        $user = $request->user();
        $to = $request->input('to');
        $file = $request->file('file');
        $stored = $file->store('faxes/outbound', 'local');
        $absolute = Storage::disk('local')->path($stored);

        try {
            $fileId = $this->faxPlus->uploadFile($absolute, $file->getClientOriginalName());
            $resp = $this->faxPlus->send($to, [$fileId]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        $faxPlusId = (string) ($resp['id'] ?? $resp['fax_id'] ?? '');
        $contactId = Contact::where('user_id', $user->id)->where('phone_e164', $to)->value('id');

        $fax = Fax::create([
            'user_id' => $user->id,
            'contact_id' => $contactId,
            'direction' => 'outbound',
            'from_e164' => $resp['from'] ?? null,
            'to_e164' => $to,
            'num_pages' => (int) ($resp['pages'] ?? 0),
            'status' => self::mapStatus((string) ($resp['status'] ?? 'queued')),
            'fax_plus_id' => $faxPlusId ?: null,
            'document_path' => $stored,
            'started_at' => now(),
            'payload' => $resp,
        ]);
        FaxDocument::create([
            'fax_id' => $fax->id,
            'original_name' => $file->getClientOriginalName(),
            'local_path' => $stored,
            'size_bytes' => $file->getSize(),
            'pages' => (int) ($resp['pages'] ?? 0),
        ]);

        return response()->json(['fax' => $this->transform($fax->fresh(['contact', 'documents']), false)], 201);
    }

    /** Stream the cached PDF of a fax (inbound or outbound). */
    public function pdf(Request $request, int $id): StreamedResponse
    {
        $user = $request->user();
        $fax = Fax::ownedBy($user)->findOrFail($id);

        $path = $fax->document_path;
        if (!$path || !Storage::disk('local')->exists($path)) {
            // Pull on demand from fax.plus if we haven't cached yet.
            if ($fax->fax_plus_id) {
                try {
                    $box = $fax->direction === 'inbound' ? 'inbox' : 'outbox';
                    $bytes = $this->faxPlus->downloadPdf($fax->fax_plus_id, $box);
                    $cached = "faxes/{$fax->direction}/{$fax->fax_plus_id}.pdf";
                    Storage::disk('local')->put($cached, $bytes);
                    $fax->update(['document_path' => $cached]);
                    $path = $cached;
                } catch (\Throwable $e) {
                    abort(502, $e->getMessage());
                }
            }
        }

        abort_unless($path && Storage::disk('local')->exists($path), 404);
        return Storage::disk('local')->response($path, "fax-{$fax->id}.pdf", ['Content-Type' => 'application/pdf']);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $fax = Fax::ownedBy($request->user())->findOrFail($id);
        if ($fax->document_path) Storage::disk('local')->delete($fax->document_path);
        $fax->delete();
        return response()->json(['ok' => true]);
    }

    private function transform(Fax $f, bool $includeOwner, bool $withDocuments = false): array
    {
        return [
            'id' => $f->id,
            'direction' => $f->direction,
            'from' => $f->from_e164,
            'to' => $f->to_e164,
            'numPages' => (int) $f->num_pages,
            'status' => $f->status,
            'errorMessage' => $f->error_message,
            'isRead' => (bool) $f->is_read,
            'costCents' => (int) $f->cost_cents,
            'startedAt' => $f->started_at,
            'endedAt' => $f->ended_at,
            'contact' => $f->contact ? ['id' => $f->contact->id, 'name' => $f->contact->display_name] : null,
            'owner' => $includeOwner && $f->user ? ['id' => $f->user->id, 'name' => $f->user->name] : null,
            'documents' => $withDocuments && $f->relationLoaded('documents')
                ? $f->documents->map(fn (FaxDocument $d) => [
                    'id' => $d->id,
                    'originalName' => $d->original_name,
                    'pages' => (int) $d->pages,
                    'sizeBytes' => (int) $d->size_bytes,
                ])
                : null,
        ];
    }

    private static function mapStatus(string $s): string
    {
        return match (strtolower($s)) {
            'queued', 'pending' => 'queued',
            'in_progress', 'processing' => 'in_progress',
            'success', 'sent', 'delivered', 'received' => 'success',
            'failed', 'error' => 'failed',
            'partially_successful' => 'partially_successful',
            'canceled', 'cancelled' => 'canceled',
            default => 'queued',
        };
    }
}
