<?php

namespace App\Events;

use App\Models\Fax;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class FaxReceived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Fax $fax) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.' . $this->fax->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'FaxReceived';
    }

    public function broadcastWith(): array
    {
        return [
            'faxId' => $this->fax->id,
            'direction' => $this->fax->direction,
            'from' => $this->fax->from_e164,
            'to' => $this->fax->to_e164,
            'numPages' => (int) $this->fax->num_pages,
            'status' => $this->fax->status,
            'startedAt' => $this->fax->started_at,
        ];
    }
}
