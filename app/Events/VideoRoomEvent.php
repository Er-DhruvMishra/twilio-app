<?php

namespace App\Events;

use App\Models\VideoRoom;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Generic room-state event so the Video page reloads on participant join /
 * leave / room ended without polling. `kind` distinguishes the trigger.
 */
class VideoRoomEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param string $kind one of: participant-joined | participant-left | room-ended | recording-ready
     */
    public function __construct(
        public VideoRoom $room,
        public string $kind,
        public array $payload = [],
    ) {}

    public function broadcastOn(): array
    {
        // The room creator + admins always get it. (Other participants are
        // notified via the in-browser twilio-video SDK directly.)
        return [new PrivateChannel('user.' . ($this->room->created_by_user_id ?? 0))];
    }

    public function broadcastAs(): string
    {
        return 'VideoRoomEvent';
    }

    public function broadcastWith(): array
    {
        return [
            'roomId' => $this->room->id,
            'twilioSid' => $this->room->twilio_room_sid,
            'kind' => $this->kind,
            'payload' => $this->payload,
        ];
    }
}
