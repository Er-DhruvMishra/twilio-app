<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\Twilio\LookupService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Background lookup. Used for `incoming_auto` source so the inbound webhook
 * doesn't block on a Twilio Lookup round-trip while building TwiML.
 */
class RunLookupJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $backoff = 5;

    public function __construct(
        public string $phoneE164,
        public string $source,
        public ?int $userId,
    ) {}

    public function handle(LookupService $service): void
    {
        $user = $this->userId ? User::find($this->userId) : null;
        $service->lookup($this->phoneE164, $this->source, $user);
    }
}
