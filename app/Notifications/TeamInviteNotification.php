<?php

namespace App\Notifications;

use App\Models\Invitation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TeamInviteNotification extends Notification
{
    use Queueable;

    public function __construct(public Invitation $invite, public string $inviterName) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $accept = url('/invite/' . $this->invite->token);
        $role = $this->invite->role_id ? \Spatie\Permission\Models\Role::find($this->invite->role_id)?->name : null;

        return (new MailMessage)
            ->subject('You\'ve been invited to Virtual Phone OS')
            ->greeting('Hello!')
            ->line("{$this->inviterName} has invited you to join their Virtual Phone OS team" . ($role ? " as a {$role}." : '.'))
            ->action('Accept invite', $accept)
            ->line('This invite expires in 7 days.');
    }
}
