<?php

namespace App\Http\Controllers\Webhooks;

use App\Events\VideoRoomEvent;
use App\Http\Controllers\Controller;
use App\Models\VideoRecording;
use App\Models\VideoRoom;
use App\Models\VideoRoomParticipant;
use App\Services\Debug\DebugLogger;
use App\Services\Twilio\AccessTokenService;
use Illuminate\Http\Request;

class VideoWebhookController extends Controller
{
    public function status(Request $request)
    {
        $event = (string) $request->input('StatusCallbackEvent', '');
        $roomSid = (string) $request->input('RoomSid', '');

        DebugLogger::log('webhooks', 'POST /webhooks/twilio/video/status', $request->all());
        DebugLogger::log('video', "webhook · {$event}", $request->all());

        match (true) {
            $event === 'room-created' => $this->onRoomCreated($request, $roomSid),
            $event === 'room-ended' => $this->onRoomEnded($request, $roomSid),
            $event === 'participant-connected' => $this->onParticipantConnected($request, $roomSid),
            $event === 'participant-disconnected' => $this->onParticipantDisconnected($request, $roomSid),
            $event === 'recording-completed' => $this->onRecordingCompleted($request, $roomSid),
            $event === 'composition-completed' => $this->onCompositionCompleted($request),
            default => null,
        };

        return response('ok');
    }

    private function onRoomCreated(Request $r, string $roomSid): void
    {
        // Most rooms are created server-side via API; this is a no-op safety net.
        VideoRoom::where('twilio_room_sid', $roomSid)
            ->update(['status' => 'in-progress', 'started_at' => now()]);
    }

    private function onRoomEnded(Request $r, string $roomSid): void
    {
        $room = VideoRoom::where('twilio_room_sid', $roomSid)->first();
        if (!$room) return;
        $duration = (int) $r->input('RoomDuration', 0);
        $room->update([
            'status' => 'completed',
            'ended_at' => now(),
            'duration_seconds' => $duration ?: $room->duration_seconds,
        ]);
        VideoRoomEvent::dispatch($room->fresh(), 'room-ended', ['durationSeconds' => $duration]);
    }

    private function onParticipantConnected(Request $r, string $roomSid): void
    {
        $room = VideoRoom::where('twilio_room_sid', $roomSid)->first();
        if (!$room) return;

        $identity = (string) $r->input('ParticipantIdentity', '');
        VideoRoomParticipant::firstOrCreate(
            ['twilio_participant_sid' => (string) $r->input('ParticipantSid', '')],
            [
                'room_id' => $room->id,
                'user_id' => AccessTokenService::userIdFromIdentity($identity),
                'identity' => $identity,
                'role' => 'participant',
                'joined_at' => now(),
            ],
        );
        VideoRoomEvent::dispatch($room, 'participant-joined', ['identity' => $identity]);
    }

    private function onParticipantDisconnected(Request $r, string $roomSid): void
    {
        $sid = (string) $r->input('ParticipantSid', '');
        $duration = (int) $r->input('ParticipantDuration', 0);
        $participant = VideoRoomParticipant::where('twilio_participant_sid', $sid)->first();
        if ($participant) {
            $participant->update(['left_at' => now(), 'duration_seconds' => $duration]);
            $room = VideoRoom::find($participant->room_id);
            if ($room) {
                VideoRoomEvent::dispatch($room, 'participant-left', [
                    'identity' => $participant->identity,
                    'durationSeconds' => $duration,
                ]);
            }
        }
    }

    private function onRecordingCompleted(Request $r, string $roomSid): void
    {
        $room = VideoRoom::where('twilio_room_sid', $roomSid)->first();
        if (!$room) return;

        VideoRecording::firstOrCreate(
            ['twilio_recording_sid' => (string) $r->input('RecordingSid', '')],
            [
                'room_id' => $room->id,
                'status' => 'completed',
                'format' => (string) ($r->input('Format', 'mka')),
                'duration_seconds' => (int) $r->input('Duration', 0),
                'size_bytes' => (int) $r->input('Size', 0),
            ],
        );
        VideoRoomEvent::dispatch($room, 'recording-ready', [
            'recordingSid' => (string) $r->input('RecordingSid', ''),
        ]);
    }

    private function onCompositionCompleted(Request $r): void
    {
        $rec = VideoRecording::where('twilio_composition_sid', (string) $r->input('CompositionSid', ''))->first();
        if (!$rec) return;
        $rec->update([
            'status' => 'completed',
            'media_url' => (string) ($r->input('MediaUri', '')),
            'duration_seconds' => (int) $r->input('Duration', 0),
            'size_bytes' => (int) $r->input('Size', 0),
        ]);
        $room = VideoRoom::find($rec->room_id);
        if ($room) {
            VideoRoomEvent::dispatch($room, 'recording-ready', [
                'compositionSid' => (string) $r->input('CompositionSid', ''),
                'mediaUrl' => (string) $r->input('MediaUri', ''),
            ]);
        }
    }
}
