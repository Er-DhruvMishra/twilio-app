<?php

namespace App\Services\Twilio;

use App\Events\MessageStatusUpdated;
use App\Models\Contact;
use App\Models\Message;
use App\Models\TwilioConfig;
use App\Models\User;
use App\Services\Debug\DebugLogger;
use App\Support\WebhookUrl;

class SmsSender
{
    public function __construct(private TwilioClientFactory $factory) {}

    /**
     * Persist a queued Message and ship it to Twilio.
     *
     * @param array<int, string> $mediaUrls public-accessible URLs Twilio will fetch and attach
     */
    public function send(User $user, string $to, string $body, array $mediaUrls = []): Message
    {
        $config = TwilioConfig::active();
        if (!$config?->phone_number) {
            throw new \RuntimeException('No active Twilio number — configure one in Settings.');
        }
        $client = $this->factory->fromConfig($config);
        $from = $config->phone_number;

        $message = Message::create([
            'user_id' => $user->id,
            'contact_id' => Contact::where('user_id', $user->id)->where('phone_e164', $to)->value('id'),
            'direction' => 'outbound',
            'from_e164' => $from,
            'to_e164' => $to,
            'body' => $body,
            'num_media' => count($mediaUrls),
            'status' => 'queued',
            'thread_key' => self::threadKey($from, $to),
        ]);

        $params = [
            'from' => $from,
            'body' => $body,
            'statusCallback' => WebhookUrl::for('webhooks/twilio/sms/status'),
        ];
        if (!empty($mediaUrls)) {
            $params['mediaUrl'] = $mediaUrls;
        }

        try {
            $sent = $client->messages->create($to, $params);
            DebugLogger::trace('messaging', 'messages.create', array_merge($params, ['to' => $to]), $sent);
            $message->update([
                'twilio_message_sid' => $sent->sid,
                'status' => $sent->status ?: 'sent',
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            DebugLogger::trace('messaging', 'messages.create', array_merge($params, ['to' => $to]), null, $e);
            $message->update([
                'status' => 'failed',
                'error_code' => method_exists($e, 'getCode') ? (string) $e->getCode() : null,
                'error_message' => $e->getMessage(),
            ]);
            // Broadcast the failure for the UI, then re-raise the real Twilio error.
            self::broadcastStatus($message->fresh());
            throw $e;
        }

        self::broadcastStatus($message->fresh());

        return $message->fresh();
    }

    /**
     * Push a status update to connected clients. Best-effort: a down or
     * misconfigured Reverb must never flip a successfully sent message to
     * "failed" (its error then overflowing error_message) or bubble out of send().
     */
    private static function broadcastStatus(Message $message): void
    {
        try {
            MessageStatusUpdated::dispatch($message);
        } catch (\Throwable $e) {
            DebugLogger::trace('messaging', 'broadcast.MessageStatusUpdated', ['message_id' => $message->id], null, $e);
            report($e);
        }
    }

    /** Stable per-pair conversation key — sorted lexicographically for symmetry. */
    public static function threadKey(string $a, string $b): string
    {
        return $a < $b ? "{$a}|{$b}" : "{$b}|{$a}";
    }
}
