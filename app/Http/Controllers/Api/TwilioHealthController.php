<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TwilioConfig;
use App\Services\Twilio\TwilioClientFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * Reachability ping for the StatusBar's Twilio dot. Uses Balance.fetch
 * because it's the cheapest authenticated call that works with BOTH
 * Auth-Token and Standard-API-Key auth — Account.fetch returns 401 with
 * Standard API Keys (those need Master Key or Auth Token). Result is
 * cached for 60s so per-page-load checks don't billboard the Twilio API.
 */
class TwilioHealthController extends Controller
{
    public function index(TwilioClientFactory $factory): JsonResponse
    {
        $config = TwilioConfig::active();
        if (!$config) {
            return response()->json([
                'configured' => false,
                'up' => null,
                'reason' => 'No Twilio config saved.',
            ]);
        }

        $result = Cache::remember('twilio.health', 60, function () use ($factory, $config) {
            try {
                $client = $factory->fromConfig($config);
                $client->balance->fetch();
                return ['up' => true, 'reason' => null, 'checkedAt' => now()->toIso8601String()];
            } catch (\Throwable $e) {
                return ['up' => false, 'reason' => $e->getMessage(), 'checkedAt' => now()->toIso8601String()];
            }
        });

        return response()->json(array_merge(['configured' => true], $result));
    }
}
