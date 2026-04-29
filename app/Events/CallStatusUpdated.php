<?php

namespace App\Events;

use App\Models\Call;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Call $call) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.' . $this->call->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'CallStatusUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'callId' => $this->call->id,
            'callSid' => $this->call->twilio_call_sid,
            'status' => $this->call->status,
            'disposition' => $this->call->disposition,
            'duration' => $this->call->duration_seconds,
            'recordingId' => $this->call->recording_id,
        ];
    }
}
