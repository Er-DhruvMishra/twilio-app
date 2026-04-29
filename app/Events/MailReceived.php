<?php

namespace App\Events;

use App\Models\Mail;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MailReceived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Mail $mail) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.' . $this->mail->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'MailReceived';
    }

    public function broadcastWith(): array
    {
        return [
            'mailId' => $this->mail->id,
            'threadId' => $this->mail->thread_id,
            'from' => $this->mail->from_email,
            'fromName' => $this->mail->from_name,
            'subject' => $this->mail->subject,
            'sentAt' => $this->mail->sent_at,
        ];
    }
}
