<?php

namespace App\Http\Controllers\Webhooks;

use App\Events\CallStatusUpdated;
use App\Http\Controllers\Controller;
use App\Jobs\ProcessRecordingDownload;
use App\Models\Call;
use App\Models\Recording;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class RecordingWebhookController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $callSid = (string) $request->input('CallSid');
        $recordingSid = (string) $request->input('RecordingSid');
        $recordingUrl = (string) $request->input('RecordingUrl');
        $recordingStatus = (string) $request->input('RecordingStatus', 'completed');
        $duration = (int) $request->input('RecordingDuration', 0);
        $channels = (int) $request->input('RecordingChannels', 1);

        if (!$recordingSid || !$callSid) {
            return response('', 204);
        }

        $call = Call::where('twilio_call_sid', $callSid)->first();
        if (!$call) {
            return response('', 204);
        }

        $recording = Recording::updateOrCreate(
            ['twilio_recording_sid' => $recordingSid],
            [
                'call_id' => $call->id,
                'media_url' => $recordingUrl . '.mp3',
                'duration_seconds' => $duration,
                'channels' => $channels,
                'status' => $recordingStatus === 'completed' ? 'processing' : $recordingStatus,
            ],
        );

        if ($call->recording_id !== $recording->id) {
            $call->update(['recording_id' => $recording->id]);
            CallStatusUpdated::dispatch($call->fresh());
        }

        if ($recordingStatus === 'completed') {
            ProcessRecordingDownload::dispatch($recording->id);
        }

        return response('', 204);
    }
}
