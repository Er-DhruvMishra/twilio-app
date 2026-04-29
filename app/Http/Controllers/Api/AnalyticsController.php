<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Analytics\MetricsAggregator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function __construct(private MetricsAggregator $metrics) {}

    public function summary(Request $request): JsonResponse
    {
        $days = (int) min(max((int) $request->query('days', 30), 1), 90);
        return response()->json($this->metrics->summary($request->user(), $days));
    }
}
