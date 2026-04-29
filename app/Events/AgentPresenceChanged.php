<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AgentPresenceChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public User $user) {}

    public function broadcastOn(): array
    {
        return [new PresenceChannel('agents')];
    }

    public function broadcastAs(): string
    {
        return 'AgentPresenceChanged';
    }

    public function broadcastWith(): array
    {
        return [
            'userId' => $this->user->id,
            'name' => $this->user->name,
            'presence' => $this->user->presence,
            'lastSeenAt' => $this->user->last_seen_at,
        ];
    }
}
