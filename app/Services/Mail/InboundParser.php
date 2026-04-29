<?php

namespace App\Services\Mail;

use App\Models\Contact;
use App\Models\Mail;
use App\Models\MailAttachment;
use App\Models\MailConfig;
use App\Models\MailThread;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Parses a SendGrid Inbound Parse multipart payload into Mail + attachments.
 * Threads via In-Reply-To / References / normalized subject.
 */
class InboundParser
{
    public function parse(Request $request): ?Mail
    {
        $from = (string) $request->input('from', '');
        $to = (string) $request->input('to', '');
        $subject = (string) $request->input('subject', '');
        $bodyText = (string) $request->input('text', '');
        $bodyHtml = (string) $request->input('html', '');
        $rawHeaders = (string) $request->input('headers', '');

        $headers = $this->parseHeaders($rawHeaders);
        $messageIdHeader = $headers['Message-Id'] ?? $headers['Message-ID'] ?? null;
        $inReplyTo = $headers['In-Reply-To'] ?? null;

        $owner = $this->resolveOwner($to);
        if (!$owner) return null;

        $thread = $this->resolveThread($owner, $subject, $inReplyTo);
        $contactId = Contact::where('user_id', $owner->id)
            ->where('email', $this->extractEmail($from))
            ->value('id');

        $mail = Mail::create([
            'user_id' => $owner->id,
            'contact_id' => $contactId,
            'thread_id' => $thread->id,
            'direction' => 'inbound',
            'message_id_header' => $messageIdHeader,
            'in_reply_to' => $inReplyTo,
            'from_email' => $this->extractEmail($from),
            'from_name' => $this->extractName($from),
            'to_email' => $this->extractEmail($to),
            'cc' => $headers['Cc'] ?? null,
            'subject' => $subject,
            'body_html' => $bodyHtml ?: null,
            'body_text' => $bodyText ?: null,
            'headers' => $headers,
            'status' => 'delivered',
            'sent_at' => now(),
            'is_read' => false,
        ]);

        $this->saveAttachments($request, $mail);

        $thread->increment('mail_count');
        $thread->increment('unread_count');
        $thread->update(['last_mail_at' => now()]);

        return $mail;
    }

    private function resolveOwner(string $to): ?User
    {
        $email = $this->extractEmail($to);
        $config = MailConfig::active();
        // For now, route all inbound mail to the config's owning user
        // (multi-tenant routing by domain/alias is a future enhancement).
        if ($config?->user_id) return User::find($config->user_id);
        return User::role('admin')->first();
    }

    private function resolveThread(User $owner, string $subject, ?string $inReplyTo): MailThread
    {
        if ($inReplyTo) {
            $existing = Mail::where('user_id', $owner->id)
                ->where('message_id_header', $inReplyTo)
                ->first();
            if ($existing && $existing->thread_id) {
                return MailThread::find($existing->thread_id);
            }
        }

        $normalized = MailThread::normalizeSubject($subject);
        $thread = MailThread::firstOrCreate(
            ['user_id' => $owner->id, 'subject_normalized' => $normalized],
            ['mail_count' => 0, 'unread_count' => 0],
        );
        return $thread;
    }

    private function saveAttachments(Request $request, Mail $mail): void
    {
        $count = (int) $request->input('attachments', 0);
        for ($i = 1; $i <= $count; $i++) {
            $file = $request->file("attachment{$i}");
            if (!$file) continue;
            $path = $file->store("mail/{$mail->id}", 'local');
            MailAttachment::create([
                'mail_id' => $mail->id,
                'original_name' => $file->getClientOriginalName(),
                'content_type' => $file->getClientMimeType() ?: 'application/octet-stream',
                'size_bytes' => $file->getSize(),
                'local_path' => $path,
            ]);
        }
    }

    private function parseHeaders(string $raw): array
    {
        $out = [];
        foreach (preg_split('/\r?\n/', $raw) ?: [] as $line) {
            if (preg_match('/^([A-Za-z0-9\-]+):\s*(.+)$/', $line, $m)) {
                $out[$m[1]] = trim($m[2]);
            }
        }
        return $out;
    }

    private function extractEmail(string $addr): string
    {
        if (preg_match('/<([^>]+)>/', $addr, $m)) return strtolower(trim($m[1]));
        return strtolower(trim($addr));
    }

    private function extractName(string $addr): ?string
    {
        if (preg_match('/^(.+?)\s*</', $addr, $m)) return trim(trim($m[1], '"\''));
        return null;
    }
}
