<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Call;
use App\Models\Contact;
use App\Models\TwilioConfig;
use App\Models\Voicemail;
use App\Services\Twilio\TwilioClientFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Twilio\TwiML\VoiceResponse;

class VoicemailController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $with = ['call:id,from_e164,to_e164,started_at,duration_seconds,contact_id', 'call.contact:id,display_name,phone_e164', 'recording:id,duration_seconds,status'];
        if ($user->isAdmin()) $with[] = 'user:id,name';

        $vms = Voicemail::with($with)
            ->ownedBy($user)
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json([
            'voicemails' => $vms->map(fn (Voicemail $v) => [
                'id' => $v->id,
                'from' => $v->call?->from_e164,
                'contact' => $v->call?->contact ? [
                    'id' => $v->call->contact->id,
                    'name' => $v->call->contact->display_name,
                ] : null,
                'owner' => $user->isAdmin() && $v->user ? [
                    'id' => $v->user->id,
                    'name' => $v->user->name,
                ] : null,
                'duration' => $v->recording?->duration_seconds ?? $v->call?->duration_seconds,
                'transcript' => $v->transcript,
                'isRead' => (bool) $v->is_read,
                'recordingId' => $v->recording_id,
                'recordingStatus' => $v->recording?->status,
                'receivedAt' => $v->call?->started_at ?? $v->created_at,
            ]),
            'unread' => $vms->where('is_read', false)->count(),
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $vm = Voicemail::ownedBy($user)->findOrFail($id);
        if ($user->isAdmin() && $vm->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.voicemail.markRead', $vm, ['viewed_user_id' => $vm->user_id]);
        }
        $vm->update(['is_read' => true]);
        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $vm = Voicemail::ownedBy($user)->findOrFail($id);
        if ($user->isAdmin() && $vm->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.voicemail.destroy', $vm, ['viewed_user_id' => $vm->user_id]);
        }
        $vm->delete();
        return response()->json(['ok' => true]);
    }

    /**
     * Send a "voicemail drop" — outbound call that plays a TTS message or a
     * provided mp3/wav URL, then hangs up. Twilio's MachineDetection helps
     * route the message correctly whether a human or voicemail box answers.
     */
    public function send(Request $request, TwilioClientFactory $factory): JsonResponse
    {
        $validated = $request->validate([
            'to' => ['required', 'string', 'starts_with:+'],
            'mode' => ['required', 'in:tts,audio_url'],
            'message' => ['required_if:mode,tts', 'nullable', 'string', 'max:1500'],
            'audio_url' => ['required_if:mode,audio_url', 'nullable', 'url'],
            'voice' => ['nullable', 'string', 'max:32'],
            'language' => ['nullable', 'string', 'max:16'],
        ]);

        $config = TwilioConfig::active();
        if (!$config?->phone_number) {
            return response()->json(['message' => 'No active Twilio number — configure one first.'], 422);
        }

        // Build a tiny TwiML doc. The Pause gives a recipient's voicemail
        // greeting time to finish before the message plays.
        $response = new VoiceResponse();
        $response->pause(['length' => 2]);
        if ($validated['mode'] === 'audio_url') {
            $response->play($validated['audio_url']);
        } else {
            $sayAttrs = [];
            if (!empty($validated['voice'])) $sayAttrs['voice'] = $validated['voice'];
            if (!empty($validated['language'])) $sayAttrs['language'] = $validated['language'];
            $response->say($validated['message'], $sayAttrs);
        }
        $response->hangup();
        $twiml = (string) $response;

        $client = $factory->fromConfig($config);

        try {
            $created = $client->calls->create(
                $validated['to'],
                $config->phone_number,
                [
                    'twiml' => $twiml,
                    // Try AMD so the message hits voicemail boxes correctly,
                    // but Twilio still plays our TwiML either way.
                    'machineDetection' => 'Enable',
                    'machineDetectionTimeout' => 10,
                    'statusCallback' => \App\Support\WebhookUrl::for('webhooks/twilio/voice/status'),
                    'statusCallbackEvent' => ['initiated', 'ringing', 'answered', 'completed'],
                    'statusCallbackMethod' => 'POST',
                ],
            );
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $contactId = Contact::where('user_id', $request->user()->id)
            ->where('phone_e164', $validated['to'])
            ->value('id');

        $call = Call::create([
            'user_id' => $request->user()->id,
            'contact_id' => $contactId,
            'twilio_call_sid' => $created->sid,
            'direction' => 'outbound',
            'from_e164' => $config->phone_number,
            'to_e164' => $validated['to'],
            'status' => 'queued',
            'disposition' => 'voicemail',
            'is_voicemail' => true,
            'started_at' => now(),
            'metadata' => ['voicemail_drop' => true, 'mode' => $validated['mode']],
        ]);

        return response()->json([
            'message' => "Voicemail to {$validated['to']} queued.",
            'callSid' => $created->sid,
            'callId' => $call->id,
        ], 201);
    }
}
