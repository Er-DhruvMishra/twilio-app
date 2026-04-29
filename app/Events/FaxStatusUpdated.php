<?php

namespace App\Events;

use App\Models\Fax;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class FaxStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Fax $fax) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.' . $this->fax->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'FaxStatusUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'faxId' => $this->fax->id,
            'status' => $this->fax->status,
            'errorMessage' => $this->fax->error_message,
            'numPages' => (int) $this->fax->num_pages,
            'costCents' => (int) $this->fax->cost_cents,
            'endedAt' => $this->fax->ended_at,
        ];
    }
}
