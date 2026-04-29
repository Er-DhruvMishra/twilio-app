<?php

namespace App\Notifications;

use App\Models\Message;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class IncomingMessageNotification extends Notification
{
    public function __construct(public Message $message) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, mixed $notification): WebPushMessage
    {
        $contact = $this->message->contact;
        $sender = $contact?->display_name ?: $this->message->from_e164;
        $preview = trim((string) $this->message->body);
        if ($preview === '' && $this->message->num_media > 0) {
            $preview = "📎 {$this->message->num_media} attachment" . ($this->message->num_media > 1 ? 's' : '');
        }
        if (mb_strlen($preview) > 140) {
            $preview = mb_substr($preview, 0, 139) . '…';
        }

        return (new WebPushMessage)
            ->title("SMS from {$sender}")
            ->body($preview)
            ->tag("sms-{$this->message->thread_key}")
            ->data([
                'type' => 'sms',
                'messageId' => $this->message->id,
                'threadKey' => $this->message->thread_key,
                'from' => $this->message->from_e164,
                'preview' => $preview,
                'ts' => now()->timestamp,
            ]);
    }
}
