<?php

namespace App\Notifications;

use App\Models\Call;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class IncomingCallNotification extends Notification
{
    public function __construct(public Call $call) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, mixed $notification): WebPushMessage
    {
        $contact = $this->call->contact;
        $caller = $contact?->display_name ?: $this->call->from_e164;

        return (new WebPushMessage)
            ->title('Incoming call')
            ->body($caller)
            ->icon('/icons/incoming-call-192.png')
            ->badge('/icons/badge-72.png')
            ->tag('call-' . $this->call->twilio_call_sid)
            ->data([
                'type' => 'incoming_call',
                'callId' => $this->call->id,
                'callSid' => $this->call->twilio_call_sid,
                'from' => $this->call->from_e164,
                'callerName' => $caller,
                'ts' => now()->timestamp,
            ])
            ->options([
                'TTL' => 30,
                'urgency' => 'high',
                'requireInteraction' => true,
            ])
            ->actions([
                ['action' => 'accept', 'title' => 'Accept'],
                ['action' => 'reject', 'title' => 'Decline'],
            ]);
    }
}
