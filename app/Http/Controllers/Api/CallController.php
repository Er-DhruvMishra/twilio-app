<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Call;
use App\Models\Contact;
use App\Models\Recording;
use App\Models\TwilioConfig;
use App\Services\Twilio\TwilioClientFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CallController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filter = $request->query('filter', 'all');
        $user = $request->user();
        $with = ['contact:id,display_name,phone_e164', 'recording:id,call_id,duration_seconds,status'];
        if ($user->isAdmin()) $with[] = 'user:id,name';

        $query = Call::with($with)
            ->ownedBy($user)
            ->orderByDesc('started_at');

        match ($filter) {
            'missed' => $query->where('disposition', 'missed'),
            'voicemail' => $query->where('is_voicemail', true),
            'incoming' => $query->where('direction', 'inbound'),
            'outgoing' => $query->where('direction', 'outbound'),
            default => null,
        };

        return response()->json([
            'calls' => $query->limit(200)->get()->map(fn ($c) => [
                'id' => $c->id,
                'direction' => $c->direction,
                'from' => $c->from_e164,
                'to' => $c->to_e164,
                'status' => $c->status,
                'disposition' => $c->disposition,
                'duration' => $c->duration_seconds,
                'startedAt' => $c->started_at,
                'isVoicemail' => $c->is_voicemail,
                'tag' => $c->tag,
                'contact' => $c->contact ? [
                    'id' => $c->contact->id,
                    'name' => $c->contact->display_name,
                ] : null,
                'owner' => $user->isAdmin() && $c->user ? [
                    'id' => $c->user->id,
                    'name' => $c->user->name,
                ] : null,
                'recording' => $c->recording_id ? [
                    'id' => $c->recording_id,
                    'duration' => $c->recording?->duration_seconds,
                    'status' => $c->recording?->status,
                ] : null,
            ]),
        ]);
    }

    /**
     * Pull call history from Twilio's REST API and upsert any rows we don't
     * have yet. Useful when calls happened on the Twilio side before this app
     * was wired up, or when the webhook missed an event.
     */
    public function syncFromTwilio(Request $request, TwilioClientFactory $factory): JsonResponse
    {
        $config = TwilioConfig::active();
        if (!$config) return response()->json(['message' => 'Twilio not configured'], 422);

        $client = $factory->fromConfig($config);
        $userId = $request->user()->id;
        $ownNumber = $config->phone_number;
        $sinceDays = (int) min(max((int) $request->query('days', 30), 1), 90);
        $startedAfter = now()->subDays($sinceDays)->toIso8601String();

        $created = 0; $updated = 0; $scanned = 0;

        $remoteCalls = $client->calls->read([
            'startTimeAfter' => $startedAfter,
        ], 200);

        foreach ($remoteCalls as $rc) {
            $scanned++;

            $direction = $rc->direction === 'inbound' ? 'inbound' : 'outbound';
            // Twilio uses E.164 in `from`/`to`. Pick the contact-side number.
            $contactNumber = $direction === 'inbound' ? (string) $rc->from : (string) $rc->to;

            $contactId = Contact::where('user_id', $userId)
                ->where('phone_e164', $contactNumber)
                ->value('id');

            $disposition = match ($rc->status) {
                'completed' => $direction === 'inbound' ? 'answered' : null,
                'no-answer', 'busy' => 'missed',
                'canceled' => 'rejected',
                'failed' => null,
                default => null,
            };

            $payload = [
                'user_id' => $userId,
                'contact_id' => $contactId,
                'direction' => $direction,
                'from_e164' => (string) $rc->from,
                'to_e164' => (string) $rc->to,
                'status' => (string) $rc->status,
                'disposition' => $disposition,
                'duration_seconds' => $rc->duration ? (int) $rc->duration : null,
                'started_at' => $rc->startTime,
                'ended_at' => $rc->endTime,
                'metadata' => [
                    'parent_call_sid' => $rc->parentCallSid,
                    'price' => $rc->price,
                    'price_unit' => $rc->priceUnit,
                    'forwarded_from' => $rc->forwardedFrom,
                ],
            ];

            $existing = Call::where('twilio_call_sid', $rc->sid)->first();
            if ($existing) {
                $existing->fill($payload)->save();
                $updated++;
            } else {
                Call::create([...$payload, 'twilio_call_sid' => $rc->sid]);
                $created++;
            }
        }

        return response()->json([
            'message' => "Synced {$scanned} calls — {$created} new, {$updated} updated.",
            'created' => $created,
            'updated' => $updated,
            'scanned' => $scanned,
        ]);
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $call = Call::ownedBy($user)->findOrFail($id);
        if ($user->isAdmin() && $call->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.call.reject', $call, ['viewed_user_id' => $call->user_id]);
        }
        $call->update([
            'status' => 'rejected',
            'disposition' => 'rejected',
            'ended_at' => now(),
        ]);
        return response()->json(['ok' => true]);
    }

    /**
     * Start recording on an in-progress call. Twilio bills ~$0.0025/min
     * for dual-channel recordings. Returns the new recording SID.
     */
    public function startRecording(Request $request, string $sid, TwilioClientFactory $factory): JsonResponse
    {
        Call::ownedBy($request->user())->where('twilio_call_sid', $sid)->firstOrFail();
        $config = TwilioConfig::active();
        if (!$config) return response()->json(['message' => 'Twilio not configured'], 422);

        try {
            $client = $factory->fromConfig($config);
            $rec = $client->calls($sid)->recordings->create([
                'recordingChannels' => 'dual',
                'recordingTrack' => 'both',
                'recordingStatusCallback' => \App\Support\WebhookUrl::for('webhooks/twilio/voice/recording'),
                'recordingStatusCallbackEvent' => ['in-progress', 'completed', 'absent'],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        return response()->json(['ok' => true, 'recordingSid' => $rec->sid]);
    }

    /** Stop any in-progress recordings on this call. */
    public function stopRecording(Request $request, string $sid, TwilioClientFactory $factory): JsonResponse
    {
        Call::ownedBy($request->user())->where('twilio_call_sid', $sid)->firstOrFail();
        $config = TwilioConfig::active();
        if (!$config) return response()->json(['message' => 'Twilio not configured'], 422);

        try {
            $client = $factory->fromConfig($config);
            $recordings = $client->calls($sid)->recordings->read(['status' => 'in-progress'], 5);
            $stopped = 0;
            foreach ($recordings as $r) {
                $client->calls($sid)->recordings($r->sid)->update(['status' => 'stopped']);
                $stopped++;
            }
            return response()->json(['ok' => true, 'stopped' => $stopped]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    /**
     * Most recent outbound call's destination — for the "tap green button on
     * empty dialer to recall the last number" flow.
     */
    public function lastOutbound(Request $request): JsonResponse
    {
        $last = Call::where('user_id', $request->user()->id)
            ->where('direction', 'outbound')
            ->whereNotNull('to_e164')
            ->orderByDesc('started_at')
            ->value('to_e164');

        return response()->json(['phone' => $last]);
    }

    public function tag(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'tag' => ['nullable', 'in:spam,important,lead'],
        ]);
        $user = $request->user();
        $call = Call::ownedBy($user)->findOrFail($id);
        if ($user->isAdmin() && $call->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.call.tag', $call, ['viewed_user_id' => $call->user_id, 'tag' => $validated['tag']]);
        }
        $call->update(['tag' => $validated['tag']]);
        return response()->json(['ok' => true]);
    }

    /** Streams a stored recording mp3 to the browser, auth-gated. */
    public function recording(Request $request, int $id): StreamedResponse
    {
        $user = $request->user();
        $recording = Recording::with('call')->findOrFail($id);
        $ownerId = $recording->call?->user_id;
        abort_unless($ownerId === $user->id || $user->isAdmin(), 403);
        abort_unless($recording->local_path && \Storage::disk('local')->exists($recording->local_path), 404);

        if ($user->isAdmin() && $ownerId !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.recording.play', $recording, ['viewed_user_id' => $ownerId]);
        }

        return \Storage::disk('local')->response($recording->local_path, "{$recording->twilio_recording_sid}.mp3", [
            'Content-Type' => 'audio/mpeg',
        ]);
    }
}
