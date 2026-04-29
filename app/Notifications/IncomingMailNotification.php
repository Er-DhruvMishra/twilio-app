<?php

namespace App\Notifications;

use App\Models\Mail;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class IncomingMailNotification extends Notification
{
    public function __construct(public Mail $mail) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, mixed $notification): WebPushMessage
    {
        $sender = $this->mail->from_name ?: $this->mail->from_email;
        $subject = trim((string) $this->mail->subject) ?: '(no subject)';
        if (mb_strlen($subject) > 140) {
            $subject = mb_substr($subject, 0, 139) . '…';
        }

        return (new WebPushMessage)
            ->title("Mail from {$sender}")
            ->body($subject)
            ->tag("mail-{$this->mail->thread_id}")
            ->data([
                'type' => 'mail',
                'mailId' => $this->mail->id,
                'threadId' => $this->mail->thread_id,
                'from' => $this->mail->from_email,
                'subject' => $subject,
                'ts' => now()->timestamp,
            ]);
    }
}
