<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageReceived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.' . $this->message->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'MessageReceived';
    }

    public function broadcastWith(): array
    {
        return [
            'messageId' => $this->message->id,
            'threadKey' => $this->message->thread_key,
            'direction' => $this->message->direction,
            'from' => $this->message->from_e164,
            'to' => $this->message->to_e164,
            'body' => $this->message->body,
            'numMedia' => $this->message->num_media,
            'sentAt' => $this->message->sent_at,
            'contact' => $this->message->contact ? [
                'id' => $this->message->contact->id,
                'name' => $this->message->contact->display_name,
            ] : null,
        ];
    }
}
