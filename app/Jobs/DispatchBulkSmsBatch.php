<?php

namespace App\Jobs;

use App\Models\BulkSmsCampaign;
use App\Models\BulkSmsRecipient;
use App\Services\Twilio\SmsSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Pulls a chunk of pending recipients off a campaign and ships them through
 * Twilio at roughly 1 message-per-second (the default Twilio long-code MPS).
 *
 * The job re-dispatches itself with a delay until the campaign is exhausted —
 * that way we never block the queue worker for hours and we naturally throttle.
 */
class DispatchBulkSmsBatch implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(public int $campaignId, public int $batchSize = 30) {}

    public function handle(SmsSender $sender): void
    {
        $campaign = BulkSmsCampaign::with('user')->find($this->campaignId);
        if (!$campaign) return;
        if (!in_array($campaign->status, ['queued', 'running'], true)) return;
        if (!$campaign->user) {
            $campaign->update(['status' => 'failed', 'completed_at' => now()]);
            return;
        }

        if ($campaign->status === 'queued') {
            $campaign->update(['status' => 'running', 'started_at' => now()]);
        }

        $batch = BulkSmsRecipient::where('campaign_id', $campaign->id)
            ->where('status', 'pending')
            ->orderBy('id')
            ->limit($this->batchSize)
            ->get();

        if ($batch->isEmpty()) {
            $remaining = BulkSmsRecipient::where('campaign_id', $campaign->id)
                ->where('status', 'pending')
                ->exists();
            if (!$remaining) {
                $campaign->update(['status' => 'completed', 'completed_at' => now()]);
            }
            return;
        }

        $sent = 0; $failed = 0;
        foreach ($batch as $recipient) {
            try {
                $msg = $sender->send($campaign->user, $recipient->phone_e164, $recipient->merged_body);
                $recipient->update([
                    'status' => 'sent',
                    'message_id' => $msg->id,
                ]);
                $sent++;
            } catch (\Throwable $e) {
                $recipient->update([
                    'status' => 'failed',
                    'error_code' => method_exists($e, 'getCode') ? (string) $e->getCode() : null,
                ]);
                $failed++;
            }
            // Pace at ~1 MPS for stock long-codes. Skip on the last item to avoid lag.
            if ($recipient !== $batch->last()) {
                usleep(1_000_000);
            }
        }

        $campaign->increment('sent_count', $sent);
        if ($failed > 0) $campaign->increment('failed_count', $failed);

        // Re-queue the next batch after a short pause.
        self::dispatch($campaign->id, $this->batchSize)->delay(now()->addSeconds(2));
    }
}
