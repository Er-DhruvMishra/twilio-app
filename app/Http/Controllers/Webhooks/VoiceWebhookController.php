<?php

namespace App\Http\Controllers\Webhooks;

use App\Events\CallStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Call;
use App\Models\CallSetting;
use App\Models\Contact;
use App\Models\TwilioConfig;
use App\Services\Debug\DebugLogger;
use App\Services\Twilio\AccessTokenService;
use App\Services\Twilio\CallRoutingService;
use App\Support\WebhookUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Twilio\TwiML\VoiceResponse;

class VoiceWebhookController extends Controller
{
    public function __construct(private CallRoutingService $routing) {}

    /**
     * Outbound: the Twilio Voice JS SDK in the browser places a call via the TwiML App.
     * Twilio invokes this webhook with the dialed `To` and `From=client:user_X`.
     */
    public function outgoing(Request $request): Response
    {
        DebugLogger::log('webhooks', 'POST /webhooks/twilio/voice/outgoing', $request->all());
        DebugLogger::log('voice', 'TwiML outgoing in', $request->all());

        $to = (string) $request->input('To');
        $fromIdentity = (string) $request->input('From');
        $userId = AccessTokenService::userIdFromIdentity($fromIdentity);

        $config = TwilioConfig::active();
        $callerId = $config?->phone_number;

        if ($userId && $to !== '') {
            Call::firstOrCreate(
                ['twilio_call_sid' => (string) $request->input('CallSid', '')],
                [
                    'user_id' => $userId,
                    'contact_id' => $this->resolveContactId($userId, $to),
                    'direction' => 'outbound',
                    'from_e164' => $callerId ?? '',
                    'to_e164' => $to,
                    'status' => 'queued',
                    'started_at' => now(),
                    'metadata' => $request->all(),
                ],
            );
        }

        $response = new VoiceResponse();
        if (!$callerId) {
            $response->say('No active Twilio number is configured for outbound calls. Please pick a number in Settings.');
            return self::twiml($response);
        }

        $dial = $response->dial('', [
            'callerId' => $callerId,
            'answerOnBridge' => true,
            'action' => WebhookUrl::for('webhooks/twilio/voice/dial-status'),
            'method' => 'POST',
        ]);
        $dial->number($to);

        return self::twiml($response);
    }

    public function incoming(Request $request): Response
    {
        $response = $this->routing->route($request->all());
        return self::twiml($response);
    }

    public function status(Request $request): Response
    {
        DebugLogger::log('webhooks', 'POST /webhooks/twilio/voice/status', $request->all());
        DebugLogger::log('voice', 'status callback', $request->all());

        $sid = (string) $request->input('CallSid');
        $status = (string) $request->input('CallStatus');
        $duration = (int) $request->input('CallDuration', 0);

        $call = Call::where('twilio_call_sid', $sid)->first();
        if ($call) {
            $patch = ['status' => $status];
            if (in_array($status, ['completed', 'busy', 'failed', 'no-answer', 'canceled'], true)) {
                $patch['ended_at'] = now();
                if ($duration > 0) $patch['duration_seconds'] = $duration;
            }
            if ($status === 'in-progress') $patch['answered_at'] = $call->answered_at ?? now();
            $call->update($patch);
            CallStatusUpdated::dispatch($call->fresh());
        }

        return response('', 204);
    }

    /**
     * Action callback at the end of a `<Dial>`. We chain TwiML when the dial
     * didn't complete — falling through forwarding chain → voicemail.
     */
    public function dialStatus(Request $request): Response
    {
        DebugLogger::log('webhooks', 'POST /webhooks/twilio/voice/dial-status', $request->all());
        DebugLogger::log('voice', 'dial-status callback', $request->all());

        $sid = (string) $request->input('CallSid');
        $dialStatus = (string) $request->input('DialCallStatus'); // completed/no-answer/busy/failed/canceled
        $dialDuration = (int) $request->input('DialCallDuration', 0);

        $call = Call::where('twilio_call_sid', $sid)->first();
        $response = new VoiceResponse();

        if ($call && $call->user_id) {
            if ($dialStatus === 'completed') {
                $call->update([
                    'status' => 'completed',
                    'disposition' => $call->disposition ?? 'answered',
                    'duration_seconds' => $dialDuration ?: $call->duration_seconds,
                    'ended_at' => now(),
                ]);
                CallStatusUpdated::dispatch($call->fresh());
                return self::twiml($response);
            }

            $settings = CallSetting::firstOrCreate(['user_id' => $call->user_id]);
            $fallback = match ($dialStatus) {
                'busy' => $settings->forward_busy_to,
                'no-answer' => $settings->forward_no_answer_to,
                'failed', 'canceled' => $settings->forward_unreachable_to,
                default => null,
            };

            if ($fallback) {
                $call->update(['disposition' => 'forwarded', 'forwarded_to_e164' => $fallback]);
                $dial = $response->dial('', [
                    'callerId' => $call->to_e164,
                    'timeout' => $settings->no_answer_timeout_seconds ?? 20,
                    'action' => WebhookUrl::for('webhooks/twilio/voice/dial-status'),
                    'method' => 'POST',
                ]);
                $dial->number($fallback);
                CallStatusUpdated::dispatch($call->fresh());
                return self::twiml($response);
            }

            // Voicemail fallback
            if ($settings->voicemail_enabled) {
                $call->update(['disposition' => 'voicemail', 'is_voicemail' => true]);
                if ($settings->voicemail_greeting_url) {
                    $response->play($settings->voicemail_greeting_url);
                } else {
                    $response->say('Please leave a message after the beep. Press # when done.');
                }
                $response->record([
                    'maxLength' => 120,
                    'finishOnKey' => '#',
                    'transcribe' => true,
                    'transcribeCallback' => WebhookUrl::for('webhooks/twilio/voice/voicemail'),
                    'action' => WebhookUrl::for('webhooks/twilio/voice/voicemail'),
                    'method' => 'POST',
                    'recordingStatusCallback' => WebhookUrl::for('webhooks/twilio/voice/recording'),
                ]);
                CallStatusUpdated::dispatch($call->fresh());
                return self::twiml($response);
            }

            $call->update([
                'status' => $dialStatus,
                'disposition' => $dialStatus === 'no-answer' ? 'missed' : ($call->disposition ?? null),
                'ended_at' => now(),
            ]);
            CallStatusUpdated::dispatch($call->fresh());
        }

        return self::twiml($response);
    }

    private function resolveContactId(int $userId, string $e164): ?int
    {
        return Contact::where('user_id', $userId)
            ->where('phone_e164', $e164)
            ->value('id');
    }

    private static function twiml(VoiceResponse $response): Response
    {
        return response((string) $response, 200, ['Content-Type' => 'text/xml']);
    }
}
