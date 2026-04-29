<?php

namespace App\Events;

use App\Models\Conversation;
use App\Models\ConversationMessage;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationMessageReceived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Conversation $conversation,
        public ConversationMessage $message,
    ) {}

    public function broadcastOn(): array
    {
        // Broadcast to the conversation owner so their threads list + the
        // current thread view both light up. Thread channel could be added
        // later for multi-participant in-room presence.
        return [new PrivateChannel('user.' . $this->conversation->owner_user_id)];
    }

    public function broadcastAs(): string
    {
        return 'ConversationMessageReceived';
    }

    public function broadcastWith(): array
    {
        return [
            'conversationId' => $this->conversation->id,
            'channel' => $this->conversation->channel,
            'messageId' => $this->message->id,
            'twilioSid' => $this->message->twilio_message_sid,
            'authorIdentity' => $this->message->author_identity,
            'body' => $this->message->body,
            'numMedia' => (int) $this->message->num_media,
            'sentAt' => $this->message->sent_at,
        ];
    }
}
