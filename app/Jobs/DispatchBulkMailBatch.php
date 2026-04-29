<?php

namespace App\Jobs;

use App\Models\Mail;
use App\Models\MailCampaign;
use App\Models\MailCampaignRecipient;
use App\Models\MailConfig;
use App\Models\MailSuppression;
use App\Models\MailThread;
use App\Services\Mail\SendGridService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Sends a batch of mail-campaign recipients through SendGrid and re-queues
 * itself until the campaign drains — same self-throttling pattern as
 * DispatchBulkSmsBatch.
 *
 * SendGrid free tier caps at 100/day, paid at 100k/day. We pace at 10/sec
 * (well under the 1k/sec API rate limit) by sleeping between sends.
 */
class DispatchBulkMailBatch implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(public int $campaignId, public int $batchSize = 50) {}

    public function handle(SendGridService $sg): void
    {
        $campaign = MailCampaign::with('template', 'user')->find($this->campaignId);
        if (!$campaign) return;
        if (!in_array($campaign->status, ['queued', 'running'], true)) return;

        if ($campaign->status === 'queued') {
            $campaign->update(['status' => 'running', 'started_at' => now()]);
        }

        $config = MailConfig::active();
        if (!$config) {
            $campaign->update(['status' => 'failed', 'completed_at' => now()]);
            return;
        }

        $batch = MailCampaignRecipient::where('campaign_id', $campaign->id)
            ->where('status', 'pending')
            ->orderBy('id')
            ->limit($this->batchSize)
            ->get();

        if ($batch->isEmpty()) {
            $remaining = MailCampaignRecipient::where('campaign_id', $campaign->id)
                ->where('status', 'pending')
                ->exists();
            if (!$remaining) {
                $campaign->update(['status' => 'completed', 'completed_at' => now()]);
            }
            return;
        }

        $sent = 0; $failed = 0;
        foreach ($batch as $recipient) {
            // Skip suppressed addresses upfront — saves a roundtrip + cost.
            if (MailSuppression::where('email', strtolower($recipient->email))->exists()) {
                $recipient->update(['status' => 'suppressed']);
                $failed++;
                continue;
            }

            try {
                $sgMessageId = $sg->send([
                    'to' => [$recipient->email],
                    'subject' => $recipient->merged_subject ?? $campaign->subject,
                    'body_html' => $recipient->merged_body_html ?? $campaign->body_html,
                ]);

                $thread = MailThread::firstOrCreate(
                    ['user_id' => $campaign->user_id, 'subject_normalized' => MailThread::normalizeSubject($campaign->subject)],
                    ['mail_count' => 0, 'unread_count' => 0],
                );

                $mail = Mail::create([
                    'user_id' => $campaign->user_id,
                    'contact_id' => $recipient->contact_id,
                    'thread_id' => $thread->id,
                    'direction' => 'outbound',
                    'sg_message_id' => $sgMessageId ?: null,
                    'from_email' => $config->from_email,
                    'from_name' => $config->from_name,
                    'to_email' => $recipient->email,
                    'subject' => $recipient->merged_subject ?? $campaign->subject,
                    'body_html' => $recipient->merged_body_html ?? $campaign->body_html,
                    'status' => 'sent',
                    'sent_at' => now(),
                    'is_read' => true,
                ]);
                $thread->increment('mail_count');
                $thread->update(['last_mail_at' => now()]);

                $recipient->update(['status' => 'sent', 'mail_id' => $mail->id]);
                $sent++;
            } catch (\Throwable $e) {
                $recipient->update(['status' => 'failed']);
                $failed++;
            }

            // ~10 messages/sec pacing.
            if ($recipient !== $batch->last()) {
                usleep(100_000);
            }
        }

        $campaign->increment('sent_count', $sent);

        // Re-queue next batch after a brief pause so other jobs can run.
        self::dispatch($campaign->id, $this->batchSize)->delay(now()->addSeconds(2));
    }
}
