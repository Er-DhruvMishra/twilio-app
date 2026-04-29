<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\DispatchBulkMailBatch;
use App\Models\Contact;
use App\Models\MailCampaign;
use App\Models\MailCampaignRecipient;
use App\Models\MailTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MailCampaignController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $campaigns = MailCampaign::where('user_id', $request->user()->id)
            ->with('template:id,name')
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json([
            'campaigns' => $campaigns->map(fn (MailCampaign $c) => $this->transform($c)),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $campaign = MailCampaign::where('user_id', $request->user()->id)
            ->with('template:id,name')
            ->findOrFail($id);

        $recipients = MailCampaignRecipient::where('campaign_id', $campaign->id)
            ->orderBy('id')
            ->limit(500)
            ->get();

        return response()->json([
            'campaign' => $this->transform($campaign),
            'recipients' => $recipients->map(fn ($r) => [
                'id' => $r->id,
                'email' => $r->email,
                'status' => $r->status,
                'mailId' => $r->mail_id,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'template_id' => ['nullable', 'integer', 'exists:mail_templates,id'],
            'subject' => ['required', 'string', 'max:500'],
            'body_html' => ['nullable', 'string'],
            'tag_ids' => ['nullable', 'array'],
            'tag_ids.*' => ['integer'],
            'contact_ids' => ['nullable', 'array'],
            'contact_ids.*' => ['integer'],
            'scheduled_at' => ['nullable', 'date', 'after:now'],
            'start_now' => ['boolean'],
        ]);

        $user = $request->user();
        $template = !empty($validated['template_id'])
            ? MailTemplate::where('user_id', $user->id)->find($validated['template_id'])
            : null;

        // Resolve recipient set: explicit contact_ids ∪ contacts with the
        // selected tags. Dedupe on email.
        $contactsQ = Contact::where('user_id', $user->id)
            ->whereNotNull('email')
            ->where('email', '!=', '');
        $contactsQ->where(function ($w) use ($validated) {
            $hasIds = !empty($validated['contact_ids']);
            $hasTags = !empty($validated['tag_ids']);
            if (!$hasIds && !$hasTags) return;
            if ($hasIds) $w->orWhereIn('id', $validated['contact_ids']);
            if ($hasTags) {
                $w->orWhereHas('tags', fn ($q) => $q->whereIn('contact_tags.id', $validated['tag_ids']));
            }
        });
        $contacts = $contactsQ->get(['id', 'display_name', 'email']);

        $deduped = $contacts->unique(fn ($c) => strtolower((string) $c->email))->values();
        if ($deduped->isEmpty()) {
            return response()->json(['message' => 'No recipients with email addresses matched.'], 422);
        }

        $campaign = MailCampaign::create([
            'user_id' => $user->id,
            'name' => $validated['name'],
            'template_id' => $template?->id,
            'subject' => $template?->subject ?? $validated['subject'],
            'body_html' => $template?->body_html ?? ($validated['body_html'] ?? ''),
            'status' => $validated['start_now'] ?? false ? 'queued' : 'draft',
            'scheduled_at' => $validated['scheduled_at'] ?? null,
            'total_recipients' => $deduped->count(),
        ]);

        foreach ($deduped as $c) {
            MailCampaignRecipient::create([
                'campaign_id' => $campaign->id,
                'contact_id' => $c->id,
                'email' => strtolower((string) $c->email),
                'merged_subject' => self::merge($campaign->subject, $c),
                'merged_body_html' => self::merge($campaign->body_html, $c),
                'status' => 'pending',
            ]);
        }

        if ($campaign->status === 'queued') {
            DispatchBulkMailBatch::dispatch($campaign->id);
        }

        return response()->json(['campaign' => $this->transform($campaign->fresh())], 201);
    }

    public function start(Request $request, int $id): JsonResponse
    {
        $campaign = MailCampaign::where('user_id', $request->user()->id)->findOrFail($id);
        if (!in_array($campaign->status, ['draft', 'queued'], true)) {
            return response()->json(['message' => "Campaign is {$campaign->status}, cannot start."], 422);
        }
        $campaign->update(['status' => 'queued']);
        DispatchBulkMailBatch::dispatch($campaign->id);
        return response()->json(['ok' => true]);
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $campaign = MailCampaign::where('user_id', $request->user()->id)->findOrFail($id);
        if (!in_array($campaign->status, ['draft', 'queued', 'running'], true)) {
            return response()->json(['message' => "Campaign is {$campaign->status}, cannot cancel."], 422);
        }
        $campaign->update(['status' => 'canceled', 'completed_at' => now()]);
        return response()->json(['ok' => true]);
    }

    private function transform(MailCampaign $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'subject' => $c->subject,
            'status' => $c->status,
            'template' => $c->relationLoaded('template') && $c->template
                ? ['id' => $c->template->id, 'name' => $c->template->name]
                : null,
            'totalRecipients' => (int) $c->total_recipients,
            'sentCount' => (int) $c->sent_count,
            'deliveredCount' => (int) $c->delivered_count,
            'openedCount' => (int) $c->opened_count,
            'clickedCount' => (int) $c->clicked_count,
            'bouncedCount' => (int) $c->bounced_count,
            'scheduledAt' => $c->scheduled_at,
            'startedAt' => $c->started_at,
            'completedAt' => $c->completed_at,
            'createdAt' => $c->created_at,
        ];
    }

    /** Replace `{{name}}` / `{{email}}` placeholders. Defensive — never explodes. */
    private static function merge(?string $template, $contact): ?string
    {
        if (!$template) return $template;
        return strtr($template, [
            '{{name}}' => (string) ($contact->display_name ?? ''),
            '{{email}}' => (string) ($contact->email ?? ''),
        ]);
    }
}
