<?php

namespace App\Notifications;

use App\Models\Voicemail;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class VoicemailNotification extends Notification
{
    public function __construct(public Voicemail $voicemail) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, mixed $notification): WebPushMessage
    {
        $from = $this->voicemail->call?->from_e164 ?? 'Unknown';
        $duration = $this->voicemail->recording?->duration_seconds ?? 0;
        $body = $this->voicemail->transcript ? mb_substr((string) $this->voicemail->transcript, 0, 140)
            : "{$from} · {$duration}s";

        return (new WebPushMessage)
            ->title("Voicemail from {$from}")
            ->body($body)
            ->tag("vm-{$this->voicemail->id}")
            ->data([
                'type' => 'voicemail',
                'voicemailId' => $this->voicemail->id,
                'from' => $from,
                'duration' => $duration,
                'ts' => now()->timestamp,
            ]);
    }
}
