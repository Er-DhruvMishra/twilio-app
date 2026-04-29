<?php

namespace App\Notifications;

use App\Models\Fax;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class IncomingFaxNotification extends Notification
{
    public function __construct(public Fax $fax) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, mixed $notification): WebPushMessage
    {
        $sender = $this->fax->contact?->display_name ?: $this->fax->from_e164 ?: 'Unknown';
        $pages = (int) $this->fax->num_pages;

        return (new WebPushMessage)
            ->title("Fax from {$sender}")
            ->body($pages > 0 ? "{$pages} page" . ($pages > 1 ? 's' : '') . ' received' : 'New fax received')
            ->tag("fax-{$this->fax->id}")
            ->data([
                'type' => 'fax',
                'faxId' => $this->fax->id,
                'from' => $this->fax->from_e164,
                'pages' => $pages,
                'ts' => now()->timestamp,
            ]);
    }
}
