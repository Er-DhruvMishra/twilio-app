<?php

namespace App\Services\Twilio;

use App\Models\TwilioConfig;
use App\Models\User;
use App\Models\VideoRoom;
use App\Services\Debug\DebugLogger;
use App\Support\WebhookUrl;

/**
 * Twilio Video wrapper. Group rooms cap at 50; group-small at 4; P2P at 2.
 * Recording is opt-in per room and incurs additional cost.
 */
class VideoService
{
    public function __construct(private TwilioClientFactory $factory) {}

    public function createRoom(User $creator, string $name, string $type, bool $recordParticipants, int $maxParticipants): VideoRoom
    {
        $client = $this->factory->fromConfig(TwilioConfig::active());

        $params = [
            'uniqueName' => $name . '-' . substr(bin2hex(random_bytes(4)), 0, 8),
            'type' => $type,
            'maxParticipants' => $maxParticipants,
            'recordParticipantsOnConnect' => $recordParticipants,
            'statusCallback' => WebhookUrl::for('webhooks/twilio/video/status'),
            'statusCallbackMethod' => 'POST',
        ];

        try {
            $tw = $client->video->v1->rooms->create($params);
            DebugLogger::trace('video', 'rooms.create', $params, $tw);
        } catch (\Throwable $e) {
            DebugLogger::trace('video', 'rooms.create', $params, null, $e);
            throw $e;
        }

        return VideoRoom::create([
            'twilio_room_sid' => $tw->sid,
            'name' => $name,
            'type' => $type,
            'status' => 'in-progress',
            'max_participants' => $maxParticipants,
            'record_participants' => $recordParticipants,
            'created_by_user_id' => $creator->id,
            'started_at' => now(),
        ]);
    }

    public function endRoom(VideoRoom $room): void
    {
        $client = $this->factory->fromConfig(TwilioConfig::active());
        try {
            $client->video->v1->rooms($room->twilio_room_sid)->update(['status' => 'completed']);
            DebugLogger::trace('video', "rooms({$room->twilio_room_sid}).update", ['status' => 'completed'], 'ok');
        } catch (\Throwable $e) {
            DebugLogger::trace('video', "rooms({$room->twilio_room_sid}).update", ['status' => 'completed'], null, $e);
            throw $e;
        }
        $room->update(['status' => 'completed', 'ended_at' => now()]);
    }

    public function kickParticipant(VideoRoom $room, string $participantSid): void
    {
        $client = $this->factory->fromConfig(TwilioConfig::active());
        try {
            $client->video->v1->rooms($room->twilio_room_sid)
                ->participants($participantSid)
                ->update(['status' => 'disconnected']);
            DebugLogger::trace('video', "rooms({$room->twilio_room_sid}).participants({$participantSid}).update", ['status' => 'disconnected'], 'ok');
        } catch (\Throwable $e) {
            DebugLogger::trace('video', "rooms({$room->twilio_room_sid}).participants({$participantSid}).update", ['status' => 'disconnected'], null, $e);
            throw $e;
        }
    }

    public function listRecordings(VideoRoom $room): array
    {
        $client = $this->factory->fromConfig(TwilioConfig::active());
        return iterator_to_array($client->video->v1->recordings->read([
            'groupingSid' => [$room->twilio_room_sid],
        ], 200));
    }

    public function composeRoom(VideoRoom $room): string
    {
        $client = $this->factory->fromConfig(TwilioConfig::active());
        $params = [
            'roomSid' => $room->twilio_room_sid,
            'audioSources' => ['*'],
            'videoLayout' => ['grid' => ['video_sources' => ['*']]],
            'format' => 'mp4',
            'statusCallback' => WebhookUrl::for('webhooks/twilio/video/status'),
            'statusCallbackMethod' => 'POST',
        ];
        try {
            $comp = $client->video->v1->compositions->create($params);
            DebugLogger::trace('video', 'compositions.create', $params, $comp);
        } catch (\Throwable $e) {
            DebugLogger::trace('video', 'compositions.create', $params, null, $e);
            throw $e;
        }
        return $comp->sid;
    }
}
