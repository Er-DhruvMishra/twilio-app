<?php

namespace App\Services\Twilio;

use App\Models\BillingSnapshot;
use App\Models\TwilioConfig;
use App\Services\Debug\DebugLogger;
use Carbon\Carbon;

/**
 * Read-only Twilio billing wrapper. Pulls account balance + usage records
 * for a date range and aggregates by category. Snapshots are cached in the
 * `billing_snapshots` table by the `billing:snapshot` artisan command.
 */
class BillingService
{
    public function __construct(private TwilioClientFactory $factory) {}

    /**
     * Live fetch: balance + usage records for a window, grouped by category.
     * Costly (one Twilio request per category-day-bucket), so prefer the
     * cached snapshot for dashboard reads.
     */
    public function summary(Carbon $start, Carbon $end): array
    {
        $config = TwilioConfig::active();
        if (!$config) {
            return $this->empty($start, $end, 'Twilio not configured');
        }

        try {
            $client = $this->factory->fromConfig($config);
            $balance = $client->balance->fetch();
            DebugLogger::trace('billing', 'balance.fetch', [], $balance);

            // Twilio's UsageRecord API supports date filtering. Use the
            // top-level read() to get all categories in one shot.
            $usageParams = [
                'startDate' => $start->toDateString(),
                'endDate' => $end->toDateString(),
            ];
            $records = $client->usage->records->read($usageParams, 200);
            DebugLogger::trace('billing', 'usage.records.read', $usageParams, ['count' => is_countable($records) ? count($records) : null]);
        } catch (\Throwable $e) {
            DebugLogger::trace('billing', 'summary', ['start' => $start->toDateString(), 'end' => $end->toDateString()], null, $e);
            return $this->empty($start, $end, $e->getMessage());
        }

        $totals = [];
        $rawRecords = [];
        foreach ($records as $r) {
            $cat = (string) ($r->category ?? 'unknown');
            $price = (float) ($r->price ?? 0);
            $count = (int) ($r->count ?? 0);
            $usage = (float) ($r->usage ?? 0);

            $totals[$cat] ??= ['category' => $cat, 'price_cents' => 0, 'count' => 0, 'usage' => 0, 'usage_unit' => $r->usageUnit ?? null];
            $totals[$cat]['price_cents'] += (int) round($price * 100);
            $totals[$cat]['count'] += $count;
            $totals[$cat]['usage'] += $usage;

            $rawRecords[] = [
                'category' => $cat,
                'description' => $r->description ?? null,
                'count' => $count,
                'usage' => $usage,
                'usage_unit' => $r->usageUnit ?? null,
                'price' => $price,
                'price_unit' => $r->priceUnit ?? null,
                'start_date' => optional($r->startDate)->format('Y-m-d') ?? null,
                'end_date' => optional($r->endDate)->format('Y-m-d') ?? null,
            ];
        }

        // Sort by spend descending so the dashboard's "top categories" is meaningful.
        usort($totals, fn ($a, $b) => $b['price_cents'] <=> $a['price_cents']);

        return [
            'window' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],
            'balance' => [
                'cents' => (int) round(((float) $balance->balance) * 100),
                'currency' => (string) ($balance->currency ?? 'USD'),
            ],
            'totals' => array_values($totals),
            'records' => $rawRecords,
            'error' => null,
        ];
    }

    /**
     * Persist a snapshot for the given window. Designed to be called by the
     * scheduler every 6h (or manually via `billing:snapshot`).
     */
    public function snapshot(Carbon $start, Carbon $end): BillingSnapshot
    {
        $summary = $this->summary($start, $end);

        return BillingSnapshot::create([
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'balance_cents' => $summary['balance']['cents'] ?? 0,
            'currency' => $summary['balance']['currency'] ?? 'USD',
            'totals' => $summary['totals'],
            'raw' => $summary['records'],
            'fetched_at' => now(),
        ]);
    }

    /** Return the most recent snapshot, or null. */
    public function latestSnapshot(): ?BillingSnapshot
    {
        return BillingSnapshot::orderByDesc('fetched_at')->first();
    }

    private function empty(Carbon $start, Carbon $end, ?string $error): array
    {
        return [
            'window' => ['start' => $start->toDateString(), 'end' => $end->toDateString()],
            'balance' => ['cents' => 0, 'currency' => 'USD'],
            'totals' => [],
            'records' => [],
            'error' => $error,
        ];
    }
}
