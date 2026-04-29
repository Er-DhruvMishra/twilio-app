<?php

namespace App\Events;

use App\Models\Call;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class IncomingCallReceived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Call $call) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.' . $this->call->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'IncomingCallReceived';
    }

    public function broadcastWith(): array
    {
        return [
            'callId' => $this->call->id,
            'callSid' => $this->call->twilio_call_sid,
            'from' => $this->call->from_e164,
            'contact' => $this->call->contact ? [
                'id' => $this->call->contact->id,
                'name' => $this->call->contact->display_name,
            ] : null,
        ];
    }
}
