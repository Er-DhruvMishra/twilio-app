<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.' . $this->message->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'MessageStatusUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'messageId' => $this->message->id,
            'threadKey' => $this->message->thread_key,
            'status' => $this->message->status,
            'errorCode' => $this->message->error_code,
            'deliveredAt' => $this->message->delivered_at,
        ];
    }
}
