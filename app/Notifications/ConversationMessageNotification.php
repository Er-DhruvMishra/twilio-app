<?php

namespace App\Notifications;

use App\Models\Conversation;
use App\Models\ConversationMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class ConversationMessageNotification extends Notification
{
    public function __construct(
        public Conversation $conversation,
        public ConversationMessage $message,
    ) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, mixed $notification): WebPushMessage
    {
        $channelLabel = match ($this->conversation->channel) {
            'chat' => 'Chat',
            'rcs' => 'RCS',
            'whatsapp' => 'WhatsApp',
            'facebook' => 'Messenger',
            default => 'Message',
        };
        $sender = $this->message->author_identity ?: 'Unknown';
        $preview = trim((string) $this->message->body);
        if ($preview === '' && $this->message->num_media > 0) {
            $preview = "📎 {$this->message->num_media} attachment" . ($this->message->num_media > 1 ? 's' : '');
        }
        if (mb_strlen($preview) > 140) {
            $preview = mb_substr($preview, 0, 139) . '…';
        }

        return (new WebPushMessage)
            ->title("{$channelLabel} · {$sender}")
            ->body($preview)
            ->tag("conv-{$this->conversation->id}")
            ->data([
                'type' => 'conversation',
                'conversationId' => $this->conversation->id,
                'channel' => $this->conversation->channel,
                'messageId' => $this->message->id,
                'preview' => $preview,
                'ts' => now()->timestamp,
            ]);
    }
}
