<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Twilio\BillingService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingController extends Controller
{
    public function __construct(private BillingService $billing) {}

    /**
     * Dashboard read. Returns the most recent snapshot for `?cached=1`
     * (default — fast) OR a live fetch for `?cached=0` (slow but fresh).
     */
    public function summary(Request $request): JsonResponse
    {
        [$start, $end] = self::resolveWindow((string) $request->query('period', 'last_30'));
        $live = $request->boolean('live');

        if (!$live) {
            $snap = $this->billing->latestSnapshot();
            if ($snap) {
                return response()->json([
                    'source' => 'cache',
                    'window' => ['start' => optional($snap->period_start)->format('Y-m-d'), 'end' => optional($snap->period_end)->format('Y-m-d')],
                    'balance' => ['cents' => (int) $snap->balance_cents, 'currency' => $snap->currency],
                    'totals' => $snap->totals ?? [],
                    'records' => $snap->raw ?? [],
                    'fetchedAt' => $snap->fetched_at,
                    'error' => null,
                ]);
            }
        }

        $summary = $this->billing->summary($start, $end);
        return response()->json(array_merge($summary, ['source' => 'live']));
    }

    /** Manually trigger a snapshot refresh. Admin-only via permission gate. */
    public function refresh(Request $request): JsonResponse
    {
        [$start, $end] = self::resolveWindow((string) $request->input('period', 'last_30'));
        $snap = $this->billing->snapshot($start, $end);
        return response()->json([
            'ok' => true,
            'snapshotId' => $snap->id,
            'fetchedAt' => $snap->fetched_at,
        ]);
    }

    private static function resolveWindow(string $period): array
    {
        $end = Carbon::now()->endOfDay();
        return match ($period) {
            'today' => [Carbon::now()->startOfDay(), $end],
            'yesterday' => [Carbon::yesterday()->startOfDay(), Carbon::yesterday()->endOfDay()],
            'last_7' => [Carbon::now()->subDays(7)->startOfDay(), $end],
            'this_month' => [Carbon::now()->startOfMonth(), $end],
            'last_month' => [Carbon::now()->subMonthNoOverflow()->startOfMonth(), Carbon::now()->subMonthNoOverflow()->endOfMonth()],
            default => [Carbon::now()->subDays(30)->startOfDay(), $end], // last_30
        };
    }
}
