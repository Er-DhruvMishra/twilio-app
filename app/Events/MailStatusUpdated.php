<?php

namespace App\Events;

use App\Models\Mail;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MailStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Mail $mail) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.' . $this->mail->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'MailStatusUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'mailId' => $this->mail->id,
            'threadId' => $this->mail->thread_id,
            'status' => $this->mail->status,
            'openedAt' => $this->mail->opened_at,
            'clickedAt' => $this->mail->clicked_at,
            'bouncedAt' => $this->mail->bounced_at,
            'errorMessage' => $this->mail->error_message,
        ];
    }
}
