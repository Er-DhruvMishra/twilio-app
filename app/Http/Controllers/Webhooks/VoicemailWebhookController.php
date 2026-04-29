<?php

namespace App\Http\Controllers\Webhooks;

use App\Events\VoicemailReceived;
use App\Http\Controllers\Controller;
use App\Jobs\ProcessRecordingDownload;
use App\Models\Call;
use App\Models\Recording;
use App\Models\Voicemail;
use App\Notifications\VoicemailNotification;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Twilio\TwiML\VoiceResponse;

/**
 * Handles two distinct callbacks Twilio sends for a voicemail:
 *
 * 1. The `<Record action>` POST: fired immediately after the caller hangs up
 *    or hits #. We use this to thank the caller and end the call cleanly.
 * 2. The `<Record transcribeCallback>` POST: fired ~seconds later with the
 *    transcript. We attach it to the existing voicemail row.
 */
class VoicemailWebhookController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $callSid = (string) $request->input('CallSid');
        $recordingSid = (string) $request->input('RecordingSid');
        $recordingUrl = (string) $request->input('RecordingUrl');
        $duration = (int) $request->input('RecordingDuration', 0);
        $transcriptionText = $request->input('TranscriptionText');

        if (!$callSid) {
            return self::twiml(new VoiceResponse());
        }

        $call = Call::where('twilio_call_sid', $callSid)->first();
        if (!$call) {
            return self::twiml(new VoiceResponse());
        }

        // Create / update the recording row.
        $recording = null;
        if ($recordingSid) {
            $recording = Recording::updateOrCreate(
                ['twilio_recording_sid' => $recordingSid],
                [
                    'call_id' => $call->id,
                    'media_url' => $recordingUrl . '.mp3',
                    'duration_seconds' => $duration,
                    'channels' => 1,
                    'status' => 'processing',
                ],
            );
            if (!$call->recording_id) {
                $call->update(['recording_id' => $recording->id]);
            }
            ProcessRecordingDownload::dispatch($recording->id);
        }

        // Find or create the voicemail row keyed off the call.
        $voicemail = Voicemail::firstOrCreate(
            ['call_id' => $call->id],
            [
                'user_id' => $call->user_id,
                'recording_id' => $recording?->id,
            ],
        );

        $patch = [];
        if ($recording && !$voicemail->recording_id) {
            $patch['recording_id'] = $recording->id;
        }
        if ($transcriptionText) {
            $patch['transcript'] = $transcriptionText;
            $patch['transcribed_at'] = now();
        }
        if (!empty($patch)) {
            $voicemail->update($patch);
        }

        // Mark the call as a voicemail outcome.
        $call->update([
            'is_voicemail' => true,
            'disposition' => $call->disposition ?? 'voicemail',
            'duration_seconds' => $duration ?: $call->duration_seconds,
            'ended_at' => $call->ended_at ?? now(),
        ]);

        VoicemailReceived::dispatch($voicemail->fresh(['call', 'recording']));

        // Web Push only fires once we have something useful: either the recording
        // landed or transcription came in. Fire on the action callback so the user
        // gets a notification immediately (transcript may follow).
        if ($call->user_id) {
            $owner = $call->user;
            if ($owner) {
                dispatch(function () use ($owner, $voicemail) {
                    $owner->notify(new VoicemailNotification($voicemail->fresh(['call', 'recording'])));
                })->afterResponse();
            }
        }

        // Action-callback path: respond with a friendly hangup; the transcribeCallback
        // is fire-and-forget so an empty TwiML is fine either way.
        $response = new VoiceResponse();
        $response->say('Thanks. Your message has been recorded.');
        $response->hangup();

        return self::twiml($response);
    }

    private static function twiml(VoiceResponse $response): Response
    {
        return response((string) $response, 200, ['Content-Type' => 'text/xml']);
    }
}
