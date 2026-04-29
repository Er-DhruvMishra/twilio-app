<?php

namespace App\Console\Commands;

use App\Services\Twilio\BillingService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class BillingSnapshot extends Command
{
    protected $signature = 'billing:snapshot {--days=30}';
    protected $description = 'Fetch current Twilio balance + usage records and persist as a billing snapshot.';

    public function handle(BillingService $billing): int
    {
        $days = (int) $this->option('days');
        $start = Carbon::now()->subDays(max(1, $days))->startOfDay();
        $end = Carbon::now()->endOfDay();

        $snap = $billing->snapshot($start, $end);
        $this->info("Snapshot {$snap->id} captured at {$snap->fetched_at} (window {$start->toDateString()} → {$end->toDateString()}).");
        return Command::SUCCESS;
    }
}
