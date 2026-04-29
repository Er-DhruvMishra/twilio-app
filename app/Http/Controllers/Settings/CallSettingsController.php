<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\CallSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CallSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $settings = CallSetting::firstOrCreate(['user_id' => $request->user()->id]);
        return response()->json(['settings' => $this->transform($settings)]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'forward_always_to' => ['nullable', 'string', 'starts_with:+', 'max:32'],
            'forward_busy_to' => ['nullable', 'string', 'starts_with:+', 'max:32'],
            'forward_no_answer_to' => ['nullable', 'string', 'starts_with:+', 'max:32'],
            'forward_unreachable_to' => ['nullable', 'string', 'starts_with:+', 'max:32'],
            'no_answer_timeout_seconds' => ['nullable', 'integer', 'min:5', 'max:120'],
            'recording_enabled' => ['boolean'],
            'recording_announcement' => ['boolean'],
            'voicemail_enabled' => ['boolean'],
            'voicemail_greeting_url' => ['nullable', 'url'],
            'default_caller_id' => ['nullable', 'string', 'starts_with:+', 'max:32'],
            'ringtone' => ['nullable', 'string', 'max:32'],
            'simultaneous_ring_to' => ['nullable', 'array'],
            'simultaneous_ring_to.*' => ['string', 'starts_with:+', 'max:32'],
            'auto_lookup_inbound' => ['boolean'],
            'auto_lookup_outbound' => ['boolean'],
            'lookup_cache_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            // Speed-dial: object keyed by digit "1"-"9", value is +E.164.
            'speed_dial_slots' => ['nullable', 'array'],
            'speed_dial_slots.*' => ['nullable', 'string', 'starts_with:+', 'max:32'],
        ]);

        // Strip empty slot values so we don't persist {"3":""} junk.
        if (isset($validated['speed_dial_slots'])) {
            $validated['speed_dial_slots'] = array_filter(
                $validated['speed_dial_slots'],
                fn ($v) => is_string($v) && trim($v) !== '',
            );
            // Reject any keys outside "1"-"9".
            $validated['speed_dial_slots'] = array_intersect_key(
                $validated['speed_dial_slots'],
                array_flip(['1', '2', '3', '4', '5', '6', '7', '8', '9']),
            );
        }

        $settings = CallSetting::firstOrCreate(['user_id' => $request->user()->id]);
        $settings->fill($validated)->save();

        return response()->json(['settings' => $this->transform($settings->fresh())]);
    }

    private function transform(CallSetting $s): array
    {
        return [
            'forwardAlwaysTo' => $s->forward_always_to,
            'forwardBusyTo' => $s->forward_busy_to,
            'forwardNoAnswerTo' => $s->forward_no_answer_to,
            'forwardUnreachableTo' => $s->forward_unreachable_to,
            'noAnswerTimeoutSeconds' => (int) ($s->no_answer_timeout_seconds ?? 20),
            'recordingEnabled' => (bool) $s->recording_enabled,
            'recordingAnnouncement' => (bool) ($s->recording_announcement ?? true),
            'voicemailEnabled' => (bool) ($s->voicemail_enabled ?? true),
            'voicemailGreetingUrl' => $s->voicemail_greeting_url,
            'defaultCallerId' => $s->default_caller_id,
            'ringtone' => $s->ringtone ?? 'classic',
            'simultaneousRingTo' => $s->simultaneous_ring_to ?? [],
            'autoLookupInbound' => (bool) ($s->auto_lookup_inbound ?? false),
            'autoLookupOutbound' => (bool) ($s->auto_lookup_outbound ?? false),
            'lookupCacheDays' => (int) ($s->lookup_cache_days ?? 30),
            'speedDialSlots' => (array) ($s->speed_dial_slots ?? []),
        ];
    }
}
