<?php

namespace App\Services\Twilio;

use App\Events\IncomingCallReceived;
use App\Jobs\RunLookupJob;
use App\Models\BlockedNumber;
use App\Models\Call;
use App\Models\CallSetting;
use App\Models\Contact;
use App\Models\RoutingRule;
use App\Models\TwilioConfig;
use App\Models\User;
use App\Notifications\IncomingCallNotification;
use App\Services\Debug\DebugLogger;
use App\Services\Twilio\LookupService;
use App\Support\WebhookUrl;
use Illuminate\Support\Collection;
use Twilio\TwiML\VoiceResponse;

/**
 * Heart of inbound call routing — converts a raw Twilio webhook into TwiML.
 *
 * MVP routing (step 9):
 *   1. Look up an owner User for this Twilio number.
 *   2. Check blocklist → reject if matched.
 *   3. Apply call settings: always-forward → forward, otherwise <Dial><Client>.
 *   4. Persist a Call row + broadcast IncomingCallReceived.
 *
 * Step 19 will expand this to consult routing_rules + routing_queues +
 * agent presence + IVR flows before falling back to direct dial.
 */
class CallRoutingService
{
    public function __construct(
        private AgentRoutingService $agents,
        private LookupService $lookups,
    ) {}

    public function route(array $params): VoiceResponse
    {
        $sid = (string) ($params['CallSid'] ?? '');
        $from = (string) ($params['From'] ?? '');
        $to = (string) ($params['To'] ?? '');

        // The `webhooks` toggle captures every inbound webhook payload so
        // signature/parse problems are easier to debug.
        DebugLogger::log('webhooks', 'POST /webhooks/twilio/voice/incoming', $params);

        $owner = $this->resolveOwner($to);
        $contactId = $owner ? $this->resolveContactId($owner->id, $from) : null;

        $response = $this->doRoute($params, $sid, $from, $to, $owner, $contactId);

        // The `voice` toggle captures the TwiML we generate so you can diff
        // real Twilio behavior against expected routing.
        DebugLogger::log('voice', 'TwiML out', [
            'call_sid' => $sid,
            'from' => $from,
            'to' => $to,
            'owner_user_id' => $owner?->id,
            'twiml' => (string) $response,
        ]);

        return $response;
    }

    private function doRoute(array $params, string $sid, string $from, string $to, $owner, $contactId): VoiceResponse
    {

        // Auto-lookup hook: queue a Twilio Lookup if the user has the toggle
        // on AND the caller isn't already a known contact. Queued (not sync)
        // so the inbound webhook responds with TwiML quickly.
        if ($owner && !$contactId && $this->lookups->shouldAutoLookupInbound($owner, $from)) {
            RunLookupJob::dispatch($from, 'incoming_auto', $owner->id)->afterResponse();
        }

        $call = Call::firstOrCreate(
            ['twilio_call_sid' => $sid],
            [
                'user_id' => $owner?->id,
                'contact_id' => $contactId,
                'direction' => 'inbound',
                'from_e164' => $from,
                'to_e164' => $to,
                'status' => 'ringing',
                'started_at' => now(),
                'metadata' => $params,
            ],
        );

        if (!$owner) {
            return $this->voiceResponseSay('No agent is configured for this number. Goodbye.');
        }

        // 1) Blocklist
        if ($this->isBlocked($owner->id, $from)) {
            $call->update(['disposition' => 'blocked', 'status' => 'rejected', 'ended_at' => now()]);
            $response = new VoiceResponse();
            $response->reject(['reason' => 'rejected']);
            return $response;
        }

        $settings = $this->settingsFor($owner);

        // 2) Always-forward overrides everything else
        if ($settings->forward_always_to) {
            $call->update(['disposition' => 'forwarded', 'forwarded_to_e164' => $settings->forward_always_to]);
            return $this->forwardTo($settings->forward_always_to, $settings, $call);
        }

        // 3) Routing rules in priority order
        if ($twiml = $this->applyRoutingRules($owner, $call, $settings)) {
            return $twiml;
        }

        // 4) Default: ring the assigned user's browser via <Dial><Client>.
        IncomingCallReceived::dispatch($call);
        // Web Push fires after the response is sent so the latency clock isn't
        // gated by Notification::send() round-trips.
        dispatch(function () use ($owner, $call) {
            $owner->notify(new IncomingCallNotification($call));
        })->afterResponse();

        $response = new VoiceResponse();
        $dialAttrs = [
            'callerId' => $from,
            'timeout' => $settings->no_answer_timeout_seconds ?? 20,
            'answerOnBridge' => true,
            'action' => WebhookUrl::for('webhooks/twilio/voice/dial-status'),
            'method' => 'POST',
        ];
        if ($settings->recording_enabled) {
            $dialAttrs['record'] = 'record-from-answer-dual';
            $dialAttrs['recordingStatusCallback'] = WebhookUrl::for('webhooks/twilio/voice/recording');
            if ($settings->recording_announcement) {
                $response->say('This call may be recorded.');
            }
        }
        $dial = $response->dial('', $dialAttrs);
        $dial->client(AccessTokenService::identityFor($owner));

        return $response;
    }

    private function applyRoutingRules(User $owner, Call $call, CallSetting $settings): ?VoiceResponse
    {
        $rules = RoutingRule::where('user_id', $owner->id)
            ->where('is_enabled', true)
            ->orderBy('priority')
            ->orderBy('id')
            ->get();

        foreach ($rules as $rule) {
            if (!$this->ruleMatches($rule, $call)) continue;

            $twiml = $this->renderRuleAction($rule, $owner, $call, $settings);
            if ($twiml) return $twiml;
        }
        return null;
    }

    private function ruleMatches(RoutingRule $rule, Call $call): bool
    {
        $value = $rule->match_value ?? [];
        $window = $rule->time_window ?? [];

        if (!self::inTimeWindow($window)) return false;

        switch ($rule->match_type) {
            case 'any':
                return true;
            case 'number_pattern':
                $regex = (string) ($value['regex'] ?? '');
                $prefix = (string) ($value['prefix'] ?? '');
                if ($regex !== '' && @preg_match('#' . $regex . '#', $call->from_e164)) return true;
                if ($prefix !== '' && str_starts_with($call->from_e164, $prefix)) return true;
                return false;
            case 'from_country':
                $iso = strtoupper((string) ($value['country'] ?? ''));
                $prefixes = self::countryDialPrefixes($iso);
                foreach ($prefixes as $p) {
                    if (str_starts_with($call->from_e164, $p)) return true;
                }
                return false;
            case 'contact_tag':
                $needTagIds = collect($value['tag_ids'] ?? [])->map(fn ($v) => (int) $v);
                if ($needTagIds->isEmpty() || !$call->contact_id) return false;
                return Contact::where('id', $call->contact_id)
                    ->whereHas('tags', fn ($q) => $q->whereIn('contact_tags.id', $needTagIds))
                    ->exists();
            case 'time_window':
                return true; // matched by inTimeWindow above
            default:
                return false;
        }
    }

    private function renderRuleAction(RoutingRule $rule, User $owner, Call $call, CallSetting $settings): ?VoiceResponse
    {
        $target = $rule->action_target ?? [];

        switch ($rule->action) {
            case 'forward':
                $to = (string) ($target['e164'] ?? '');
                if ($to === '') return null;
                $call->update(['disposition' => 'forwarded', 'forwarded_to_e164' => $to]);
                return $this->forwardTo($to, $settings, $call);

            case 'voicemail':
                $call->update(['disposition' => 'voicemail', 'is_voicemail' => true]);
                $response = new VoiceResponse();
                if ($settings->voicemail_greeting_url) {
                    $response->play($settings->voicemail_greeting_url);
                } else {
                    $response->say('Please leave a message after the beep.');
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
                return $response;

            case 'ivr':
                // Real IVR rendering ships with step 20. For now redirect to a placeholder.
                $flowId = (int) ($target['ivr_flow_id'] ?? 0);
                if (!$flowId) return null;
                $response = new VoiceResponse();
                $response->redirect(WebhookUrl::for("webhooks/twilio/ivr/{$flowId}/entry"), ['method' => 'POST']);
                return $response;

            case 'queue':
                $queueName = (string) ($target['queue_name'] ?? 'support');
                $waitUrl = (string) ($target['wait_url'] ?? '');
                $response = new VoiceResponse();
                $args = [];
                if ($waitUrl !== '') $args['waitUrl'] = $waitUrl;
                $response->enqueue($queueName, $args);
                return $response;

            case 'ring_user':
            case 'simultaneous_ring':
            case 'priority_list':
            case 'round_robin':
            case 'skill_based':
                $agents = $this->agents->selectAgents($rule);
                if ($agents->isEmpty()) return null;
                IncomingCallReceived::dispatch($call);
                $this->fireWebPushTo($agents, $call);
                return $this->dialAgents($agents, $call, $settings);

            default:
                return null;
        }
    }

    private function dialAgents(Collection $agents, Call $call, CallSetting $settings): VoiceResponse
    {
        $response = new VoiceResponse();
        $dialAttrs = [
            'callerId' => $call->from_e164,
            'timeout' => $settings->no_answer_timeout_seconds ?? 20,
            'answerOnBridge' => true,
            'action' => WebhookUrl::for('webhooks/twilio/voice/dial-status'),
            'method' => 'POST',
        ];
        if ($settings->recording_enabled) {
            $dialAttrs['record'] = 'record-from-answer-dual';
            $dialAttrs['recordingStatusCallback'] = WebhookUrl::for('webhooks/twilio/voice/recording');
            if ($settings->recording_announcement) {
                $response->say('This call may be recorded.');
            }
        }
        $dial = $response->dial('', $dialAttrs);
        foreach ($agents as $agent) {
            $dial->client(AccessTokenService::identityFor($agent));
        }
        return $response;
    }

    private function fireWebPushTo(Collection $agents, Call $call): void
    {
        foreach ($agents as $agent) {
            dispatch(function () use ($agent, $call) {
                $agent->notify(new IncomingCallNotification($call));
            })->afterResponse();
        }
    }

    private static function inTimeWindow(array $window): bool
    {
        if (empty($window)) return true;
        $tz = (string) ($window['tz'] ?? config('app.timezone', 'UTC'));
        try {
            $now = now($tz);
        } catch (\Throwable) {
            $now = now();
        }

        $weekdays = $window['weekdays'] ?? null;
        if (is_array($weekdays) && !empty($weekdays)) {
            $today = (int) $now->isoWeekday();
            if (!in_array($today, array_map('intval', $weekdays), true)) return false;
        }

        $start = $window['start'] ?? null;
        $end = $window['end'] ?? null;
        if ($start && $end) {
            $hhmm = $now->format('H:i');
            if ($hhmm < $start || $hhmm >= $end) return false;
        }
        return true;
    }

    private static function countryDialPrefixes(string $iso): array
    {
        // Minimal lookup. Add more as needed.
        return match ($iso) {
            'US', 'CA' => ['+1'],
            'GB' => ['+44'],
            'IN' => ['+91'],
            'AU' => ['+61'],
            'DE' => ['+49'],
            'FR' => ['+33'],
            'NL' => ['+31'],
            'SG' => ['+65'],
            'JP' => ['+81'],
            'BR' => ['+55'],
            'MX' => ['+52'],
            default => [],
        };
    }

    private function forwardTo(string $e164, CallSetting $settings, Call $call): VoiceResponse
    {
        $response = new VoiceResponse();
        $dialAttrs = [
            'callerId' => $call->to_e164,
            'timeout' => $settings->no_answer_timeout_seconds ?? 20,
            'action' => WebhookUrl::for('webhooks/twilio/voice/dial-status'),
            'method' => 'POST',
        ];
        if ($settings->recording_enabled) {
            $dialAttrs['record'] = 'record-from-answer-dual';
            $dialAttrs['recordingStatusCallback'] = WebhookUrl::for('webhooks/twilio/voice/recording');
        }
        $dial = $response->dial('', $dialAttrs);
        $dial->number($e164);
        return $response;
    }

    private function resolveOwner(string $toE164): ?User
    {
        $config = TwilioConfig::active();
        if (!$config || $config->phone_number !== $toE164) {
            return User::role('admin')->first();
        }
        return $config->user_id
            ? User::find($config->user_id)
            : User::role('admin')->first();
    }

    private function resolveContactId(int $userId, string $e164): ?int
    {
        return Contact::where('user_id', $userId)
            ->where('phone_e164', $e164)
            ->value('id');
    }

    private function settingsFor(User $user): CallSetting
    {
        return CallSetting::firstOrCreate(['user_id' => $user->id]);
    }

    private function isBlocked(int $userId, string $from): bool
    {
        $rules = BlockedNumber::where('user_id', $userId)->get();
        if ($rules->isEmpty()) return false;

        $blacklist = $rules->where('mode', 'blacklist');
        $whitelist = $rules->where('mode', 'whitelist');

        $matchAny = function ($collection) use ($from): bool {
            foreach ($collection as $rule) {
                $type = $rule->pattern_type ?? 'exact';
                $value = $rule->pattern_value ?: $rule->phone_e164;
                if ($type === 'exact' && $from === $value) return true;
                if ($type === 'prefix' && str_starts_with($from, $value)) return true;
                if ($type === 'country' && str_starts_with($from, '+' . ltrim($value, '+'))) return true;
            }
            return false;
        };

        if ($whitelist->isNotEmpty() && !$matchAny($whitelist)) return true;
        if ($matchAny($blacklist)) return true;
        return false;
    }

    private function voiceResponseSay(string $text): VoiceResponse
    {
        $response = new VoiceResponse();
        $response->say($text);
        return $response;
    }
}
