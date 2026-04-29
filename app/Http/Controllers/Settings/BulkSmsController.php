<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Jobs\DispatchBulkSmsBatch;
use App\Models\BulkSmsCampaign;
use App\Models\BulkSmsRecipient;
use App\Models\Contact;
use App\Models\SmsTemplate;
use App\Services\Contacts\PhoneNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BulkSmsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $campaigns = BulkSmsCampaign::with('template:id,name')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (BulkSmsCampaign $c) => $this->transform($c));

        return response()->json(['campaigns' => $campaigns]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $campaign = BulkSmsCampaign::with('template:id,name,body')
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $recipientStats = BulkSmsRecipient::where('campaign_id', $id)
            ->selectRaw('status, COUNT(*) as cnt')
            ->groupBy('status')
            ->pluck('cnt', 'status');

        return response()->json([
            'campaign' => $this->transform($campaign),
            'recipients' => $recipientStats,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'template_id' => ['nullable', 'integer'],
            'body' => ['nullable', 'string', 'max:1600'],
            'audience' => ['required', 'array'],
            'audience.contact_ids' => ['nullable', 'array'],
            'audience.contact_ids.*' => ['integer'],
            'audience.tag_ids' => ['nullable', 'array'],
            'audience.tag_ids.*' => ['integer'],
            'audience.numbers' => ['nullable', 'array'],
            'audience.numbers.*' => ['string'],
            'variables' => ['nullable', 'array'],
            'start_now' => ['boolean'],
        ]);

        $userId = $request->user()->id;

        $body = $validated['body'] ?? null;
        if (!$body && !empty($validated['template_id'])) {
            $template = SmsTemplate::where('user_id', $userId)->findOrFail($validated['template_id']);
            $body = $template->body;
        }
        if (!$body) {
            return response()->json(['message' => 'Provide either a template_id or body'], 422);
        }

        // Resolve audience to a deduped list of phone numbers + optional contact ids
        $contacts = collect();
        if (!empty($validated['audience']['contact_ids'])) {
            $contacts = $contacts->concat(
                Contact::where('user_id', $userId)
                    ->whereIn('id', $validated['audience']['contact_ids'])
                    ->get()
            );
        }
        if (!empty($validated['audience']['tag_ids'])) {
            $contacts = $contacts->concat(
                Contact::where('user_id', $userId)
                    ->whereHas('tags', fn ($q) => $q->whereIn('contact_tags.id', $validated['audience']['tag_ids']))
                    ->get()
            );
        }
        $contacts = $contacts->unique('id');

        $rawNumbers = collect($validated['audience']['numbers'] ?? [])
            ->map(fn ($n) => PhoneNormalizer::normalize((string) $n)[0])
            ->filter();

        $byNumber = $contacts->keyBy('phone_e164');
        $allNumbers = $contacts->pluck('phone_e164')->concat($rawNumbers)->unique()->filter()->values();

        if ($allNumbers->isEmpty()) {
            return response()->json(['message' => 'Audience is empty'], 422);
        }

        $campaign = DB::transaction(function () use ($userId, $validated, $body, $allNumbers, $byNumber) {
            $campaign = BulkSmsCampaign::create([
                'user_id' => $userId,
                'template_id' => $validated['template_id'] ?? null,
                'name' => $validated['name'],
                'status' => 'queued',
                'total_recipients' => $allNumbers->count(),
                'sent_count' => 0,
                'failed_count' => 0,
            ]);

            $vars = $validated['variables'] ?? [];

            BulkSmsRecipient::insert($allNumbers->map(function ($num) use ($campaign, $body, $byNumber, $vars) {
                $contact = $byNumber->get($num);
                $merged = self::merge($body, [
                    ...$vars,
                    'contact_name' => $contact?->display_name ?? '',
                    'phone' => $num,
                ]);
                return [
                    'campaign_id' => $campaign->id,
                    'contact_id' => $contact?->id,
                    'phone_e164' => $num,
                    'merged_body' => $merged,
                    'status' => 'pending',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            })->toArray());

            return $campaign;
        });

        if ($validated['start_now'] ?? true) {
            DispatchBulkSmsBatch::dispatch($campaign->id);
        }

        return response()->json(['campaign' => $this->transform($campaign->fresh())], 201);
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $campaign = BulkSmsCampaign::where('user_id', $request->user()->id)->findOrFail($id);
        $campaign->update(['status' => 'canceled', 'completed_at' => now()]);
        // Pending recipients are left in 'pending' but will be skipped because the
        // job exits early when status !== queued|running.
        return response()->json(['ok' => true]);
    }

    private function transform(BulkSmsCampaign $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'status' => $c->status,
            'totalRecipients' => (int) $c->total_recipients,
            'sentCount' => (int) $c->sent_count,
            'failedCount' => (int) $c->failed_count,
            'startedAt' => $c->started_at,
            'completedAt' => $c->completed_at,
            'template' => $c->relationLoaded('template') && $c->template ? [
                'id' => $c->template->id,
                'name' => $c->template->name,
            ] : null,
            'createdAt' => $c->created_at,
        ];
    }

    /** Replace `{var}` placeholders. Unknown variables become empty strings. */
    private static function merge(string $body, array $vars): string
    {
        return preg_replace_callback('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', function ($m) use ($vars) {
            return (string) ($vars[$m[1]] ?? '');
        }, $body);
    }
}
