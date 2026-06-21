<?php

namespace App\Http\Controllers\Webhooks;

use App\Events\MessageReceived;
use App\Events\MessageStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Message;
use App\Models\MessageMedia;
use App\Models\TwilioConfig;
use App\Models\User;
use App\Notifications\IncomingMessageNotification;
use App\Services\Debug\DebugLogger;
use App\Services\Twilio\AutoReplyEvaluator;
use App\Services\Twilio\SmsSender;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Twilio\TwiML\MessagingResponse;

class SmsWebhookController extends Controller
{
    public function __construct(private AutoReplyEvaluator $autoReply) {}

    public function incoming(Request $request): Response
    {
        DebugLogger::log('webhooks', 'POST /webhooks/twilio/sms/incoming', $request->all());
        DebugLogger::log('messaging', 'inbound', $request->only(['From', 'To', 'Body', 'NumMedia', 'MessageSid']));
        $sid = (string) $request->input('MessageSid');
        $from = (string) $request->input('From');
        $to = (string) $request->input('To');
        $body = (string) $request->input('Body', '');
        $numMedia = (int) $request->input('NumMedia', 0);

        $owner = $this->resolveOwner($to);
        $contactId = $owner ? Contact::where('user_id', $owner->id)
            ->where('phone_e164', $from)
            ->value('id') : null;

        $message = Message::firstOrCreate(
            ['twilio_message_sid' => $sid],
            [
                'user_id' => $owner?->id,
                'contact_id' => $contactId,
                'direction' => 'inbound',
                'from_e164' => $from,
                'to_e164' => $to,
                'body' => $body,
                'num_media' => $numMedia,
                'status' => 'received',
                'sent_at' => now(),
                'thread_key' => SmsSender::threadKey($from, $to),
            ],
        );

        // Stash any inbound media URLs (public Twilio URLs — auth required to fetch).
        for ($i = 0; $i < $numMedia; $i++) {
            $url = (string) $request->input("MediaUrl{$i}");
            $contentType = (string) $request->input("MediaContentType{$i}");
            if ($url) {
                MessageMedia::firstOrCreate(
                    ['message_id' => $message->id, 'media_url' => $url],
                    ['content_type' => $contentType ?: 'application/octet-stream'],
                );
            }
        }

        if ($owner) {
            MessageReceived::dispatch($message);
            dispatch(function () use ($owner, $message) {
                $owner->notify(new IncomingMessageNotification($message));
            })->afterResponse();

            // Run auto-reply rules after we've responded so latency stays low.
            dispatch(function () use ($message) {
                try {
                    $this->autoReply->evaluate($message);
                } catch (\Throwable) {
                    // ignore — auto-reply must never break inbound delivery
                }
            })->afterResponse();
        }

        return self::twiml(new MessagingResponse());
    }

    public function status(Request $request): Response
    {
        $sid = (string) $request->input('MessageSid');
        $status = (string) $request->input('MessageStatus');
        $errorCode = $request->input('ErrorCode');
        $errorMessage = $request->input('ErrorMessage');

        $message = Message::where('twilio_message_sid', $sid)->first();
        if ($message) {
            $patch = ['status' => $status];
            if ($errorCode) $patch['error_code'] = (string) $errorCode;
            if ($errorMessage) $patch['error_message'] = (string) $errorMessage;
            if ($status === 'delivered') $patch['delivered_at'] = now();
            $message->update($patch);
            // Best-effort: a down Reverb must not 500 Twilio's status callback.
            try {
                MessageStatusUpdated::dispatch($message->fresh());
            } catch (\Throwable $e) {
                DebugLogger::trace('messaging', 'broadcast.MessageStatusUpdated', ['message_id' => $message->id], null, $e);
                report($e);
            }
        }

        return response('', 204);
    }

    private function resolveOwner(string $_toE164): ?User
    {
        // For now, every inbound SMS lands with the active Twilio config's owner.
        // The $_toE164 hint is kept for the multi-number / multi-tenant follow-up.
        $config = TwilioConfig::active();
        if (!$config) return User::role('admin')->first();
        if ($config->user_id) return User::find($config->user_id);
        return User::role('admin')->first();
    }

    private static function twiml(MessagingResponse $r): Response
    {
        return response((string) $r, 200, ['Content-Type' => 'text/xml']);
    }
}
