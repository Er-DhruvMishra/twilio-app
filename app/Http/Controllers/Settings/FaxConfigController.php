<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\FaxConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FaxConfigController extends Controller
{
    public function show(): JsonResponse
    {
        $config = FaxConfig::active() ?? new FaxConfig();
        return response()->json([
            'config' => [
                'configured' => (bool) $config->id,
                'fromNumber' => $config->from_number,
                'isActive' => (bool) $config->is_active,
                'verifiedAt' => $config->verified_at,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_token' => ['required', 'string', 'min:16'],
            'webhook_signing_key' => ['nullable', 'string', 'min:8'],
            'from_number' => ['required', 'string', 'starts_with:+', 'max:32'],
        ]);

        FaxConfig::query()->update(['is_active' => false]);
        $config = FaxConfig::create([
            'user_id' => $request->user()->id,
            'api_token' => $validated['api_token'],
            'webhook_signing_key' => $validated['webhook_signing_key'] ?? null,
            'from_number' => $validated['from_number'],
            'is_active' => true,
            'verified_at' => now(),
        ]);

        return response()->json([
            'config' => [
                'configured' => true,
                'fromNumber' => $config->from_number,
                'isActive' => true,
                'verifiedAt' => $config->verified_at,
            ],
        ], 201);
    }
}
