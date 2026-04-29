<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Mail;
use App\Models\MailAttachment;
use App\Models\MailConfig;
use App\Models\MailSuppression;
use App\Models\MailTemplate;
use App\Models\MailThread;
use App\Services\Mail\SendGridService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MailController extends Controller
{
    public function __construct(private SendGridService $sg) {}

    public function threads(Request $request): JsonResponse
    {
        $user = $request->user();
        $with = ['user:id,name'];

        $threads = MailThread::with($user->isAdmin() ? $with : [])
            ->ownedBy($user)
            ->orderByDesc('last_mail_at')
            ->limit(200)
            ->get();

        $latestPerThread = Mail::ownedBy($user)
            ->whereIn('thread_id', $threads->pluck('id'))
            ->select('thread_id', DB::raw('MAX(id) as latest_id'))
            ->groupBy('thread_id')
            ->pluck('latest_id', 'thread_id');

        $latestMails = Mail::with('attachments:id,mail_id,original_name')
            ->whereIn('id', $latestPerThread->values())
            ->get()
            ->keyBy('thread_id');

        return response()->json([
            'threads' => $threads->map(function (MailThread $t) use ($latestMails, $user) {
                $m = $latestMails->get($t->id);
                return [
                    'id' => $t->id,
                    'subject' => $m?->subject ?? $t->subject_normalized,
                    'unread' => (int) $t->unread_count,
                    'mailCount' => (int) $t->mail_count,
                    'lastMailAt' => $t->last_mail_at,
                    'preview' => $m ? mb_substr(strip_tags($m->body_text ?? $m->body_html ?? ''), 0, 120) : '',
                    'lastFrom' => $m?->from_email,
                    'owner' => $user->isAdmin() && $t->user ? ['id' => $t->user->id, 'name' => $t->user->name] : null,
                ];
            }),
        ]);
    }

    public function thread(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $thread = MailThread::ownedBy($user)->findOrFail($id);

        if ($user->isAdmin() && $thread->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.mail.thread', $thread, ['viewed_user_id' => $thread->user_id]);
        }

        $mails = Mail::with('attachments:id,mail_id,original_name,content_type,size_bytes')
            ->where('thread_id', $id)
            ->orderBy('id')
            ->get();

        // Mark inbound as read for the owner only.
        Mail::where('thread_id', $id)
            ->where('user_id', $user->id)
            ->where('direction', 'inbound')
            ->where('is_read', false)
            ->update(['is_read' => true]);
        $thread->update(['unread_count' => 0]);

        return response()->json([
            'thread' => [
                'id' => $thread->id,
                'subject' => $thread->subject_normalized,
                'mailCount' => (int) $thread->mail_count,
            ],
            'mails' => $mails->map(fn (Mail $m) => [
                'id' => $m->id,
                'direction' => $m->direction,
                'from' => $m->from_email,
                'fromName' => $m->from_name,
                'to' => $m->to_email,
                'cc' => $m->cc,
                'subject' => $m->subject,
                'bodyHtml' => $m->body_html,
                'bodyText' => $m->body_text,
                'status' => $m->status,
                'sentAt' => $m->sent_at,
                'attachments' => $m->attachments->map(fn ($a) => [
                    'id' => $a->id,
                    'name' => $a->original_name,
                    'contentType' => $a->content_type,
                    'sizeBytes' => $a->size_bytes,
                ]),
            ]),
        ]);
    }

    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to' => ['required', 'string', 'email', 'max:160'],
            'cc' => ['nullable', 'string', 'max:1000'],
            'bcc' => ['nullable', 'string', 'max:1000'],
            'subject' => ['required', 'string', 'max:500'],
            'body_html' => ['nullable', 'string'],
            'body_text' => ['nullable', 'string'],
            'template_id' => ['nullable', 'integer', 'exists:mail_templates,id'],
            'in_reply_to' => ['nullable', 'string', 'max:255'],
            // SendGrid hard cap: 30MB per email (all attachments + body combined).
            // Stay safely under by capping each file at 25MB and total at 28MB.
            'attachments' => ['nullable', 'array', 'max:10'],
            'attachments.*' => ['file', 'max:25600'],
        ]);

        $user = $request->user();
        $config = MailConfig::active();
        if (!$config) return response()->json(['message' => 'SendGrid not configured.'], 422);

        // Block if recipient is suppressed.
        if (MailSuppression::where('email', strtolower($validated['to']))->exists()) {
            return response()->json(['message' => 'Recipient is suppressed (bounce/spam/unsubscribe).'], 422);
        }

        $template = !empty($validated['template_id']) ? MailTemplate::find($validated['template_id']) : null;

        // Stage attachments to local disk + build the SendGrid payload entries
        // (base64 content, type, filename) before hitting the API.
        $files = $request->file('attachments') ?? [];
        $totalBytes = array_sum(array_map(fn ($f) => (int) $f->getSize(), $files));
        if ($totalBytes > 28 * 1024 * 1024) {
            return response()->json(['message' => 'Total attachment size exceeds SendGrid 28MB limit.'], 422);
        }
        $sgAttachments = [];
        $stagedFiles = [];
        foreach ($files as $file) {
            $stored = $file->store('mail/outbound', 'local');
            $stagedFiles[] = [
                'file' => $file,
                'path' => $stored,
            ];
            $sgAttachments[] = [
                'content' => base64_encode((string) file_get_contents(\Storage::disk('local')->path($stored))),
                'type' => $file->getClientMimeType() ?: 'application/octet-stream',
                'filename' => $file->getClientOriginalName(),
                'disposition' => 'attachment',
            ];
        }

        try {
            $sgMessageId = $this->sg->send(array_filter([
                'to' => [$validated['to']],
                'cc' => $validated['cc'] ? array_map('trim', explode(',', $validated['cc'])) : null,
                'bcc' => $validated['bcc'] ? array_map('trim', explode(',', $validated['bcc'])) : null,
                'subject' => $template?->subject ?? $validated['subject'],
                'body_html' => $template?->body_html ?? ($validated['body_html'] ?? null),
                'body_text' => $validated['body_text'] ?? null,
                'template_id' => $template?->sg_template_id,
                'attachments' => !empty($sgAttachments) ? $sgAttachments : null,
            ], fn ($v) => $v !== null && $v !== ''));
        } catch (\Throwable $e) {
            // Don't leave orphan staged files when send fails.
            foreach ($stagedFiles as $sf) {
                \Storage::disk('local')->delete($sf['path']);
            }
            return response()->json(['message' => $e->getMessage()], 502);
        }

        $thread = $this->resolveOutboundThread($user, $validated);
        $contactId = Contact::where('user_id', $user->id)->where('email', $validated['to'])->value('id');

        $mail = Mail::create([
            'user_id' => $user->id,
            'contact_id' => $contactId,
            'thread_id' => $thread->id,
            'direction' => 'outbound',
            'sg_message_id' => $sgMessageId ?: null,
            'in_reply_to' => $validated['in_reply_to'] ?? null,
            'from_email' => $config->from_email,
            'from_name' => $config->from_name,
            'to_email' => $validated['to'],
            'cc' => $validated['cc'] ?? null,
            'bcc' => $validated['bcc'] ?? null,
            'subject' => $template?->subject ?? $validated['subject'],
            'body_html' => $template?->body_html ?? ($validated['body_html'] ?? null),
            'body_text' => $validated['body_text'] ?? null,
            'status' => 'sent',
            'sent_at' => now(),
            'is_read' => true,
        ]);

        $thread->increment('mail_count');
        $thread->update(['last_mail_at' => now()]);

        // Persist attachment rows so the thread view can show + serve them.
        foreach ($stagedFiles as $sf) {
            MailAttachment::create([
                'mail_id' => $mail->id,
                'original_name' => $sf['file']->getClientOriginalName(),
                'content_type' => $sf['file']->getClientMimeType() ?: 'application/octet-stream',
                'size_bytes' => (int) $sf['file']->getSize(),
                'local_path' => $sf['path'],
            ]);
        }

        return response()->json([
            'mail' => [
                'id' => $mail->id,
                'threadId' => $thread->id,
                'attachmentCount' => count($stagedFiles),
            ],
        ], 201);
    }

    public function attachment(Request $request, int $id): StreamedResponse
    {
        $user = $request->user();
        $att = MailAttachment::with('mail')->findOrFail($id);
        abort_unless($att->mail && ($att->mail->user_id === $user->id || $user->isAdmin()), 403);

        if ($user->isAdmin() && $att->mail->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.mail.attachment', $att->mail, ['viewed_user_id' => $att->mail->user_id]);
        }

        return Storage::disk('local')->response($att->local_path, $att->original_name, [
            'Content-Type' => $att->content_type,
        ]);
    }

    public function suppressions(Request $request): JsonResponse
    {
        $type = $request->query('type');
        $query = MailSuppression::orderByDesc('suppressed_at');
        if ($type) $query->where('type', $type);
        return response()->json(['suppressions' => $query->limit(500)->get()]);
    }

    public function removeSuppression(Request $request, string $email): JsonResponse
    {
        $type = $request->query('type', 'bounce');
        try {
            $this->sg->removeSuppression($email, $type);
        } catch (\Throwable) { /* fall through and clear locally anyway */ }
        MailSuppression::where('email', $email)->where('type', $type)->delete();
        return response()->json(['ok' => true]);
    }

    public function stats(Request $request): JsonResponse
    {
        $start = $request->query('start', Carbon::now()->subDays(30)->toDateString());
        $end = $request->query('end', Carbon::now()->toDateString());
        try {
            $live = $this->sg->getStats($start, $end, 'day');
        } catch (\Throwable $e) {
            return response()->json(['stats' => [], 'error' => $e->getMessage()]);
        }
        return response()->json(['stats' => $live]);
    }

    private function resolveOutboundThread($user, array $payload): MailThread
    {
        if (!empty($payload['in_reply_to'])) {
            $existing = Mail::where('user_id', $user->id)->where('message_id_header', $payload['in_reply_to'])->first();
            if ($existing && $existing->thread_id) return MailThread::find($existing->thread_id);
        }
        $normalized = MailThread::normalizeSubject($payload['subject'] ?? '');
        return MailThread::firstOrCreate(
            ['user_id' => $user->id, 'subject_normalized' => $normalized],
            ['mail_count' => 0, 'unread_count' => 0],
        );
    }
}
