<?php

namespace App\Events;

use App\Models\Lookup;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fires after a Twilio Lookup resolves. The IncomingCallSheet, Phone/InCall,
 * and Lookup history page all subscribe so the caller's identity appears
 * without a refresh — important for auto-inbound lookups where the user
 * never clicks anything to trigger the fetch.
 */
class LookupCompleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Lookup $lookup) {}

    public function broadcastOn(): array
    {
        // No requester (system-driven cache refresh) → nobody to notify.
        $userId = $this->lookup->requested_by_user_id;
        if (!$userId) return [];
        return [new PrivateChannel('user.' . $userId)];
    }

    public function broadcastAs(): string
    {
        return 'LookupCompleted';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->lookup->id,
            'phone' => $this->lookup->phone_e164,
            'callerName' => $this->lookup->caller_name,
            'callerType' => $this->lookup->caller_type,
            'lineType' => $this->lookup->line_type,
            'carrierName' => $this->lookup->carrier_name,
            'countryCode' => $this->lookup->country_code,
            'isValid' => (bool) $this->lookup->is_valid,
            'source' => $this->lookup->source,
        ];
    }
}
