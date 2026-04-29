<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\MailConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MailConfigController extends Controller
{
    public function show(): JsonResponse
    {
        $config = MailConfig::active() ?? new MailConfig();
        return response()->json([
            'config' => [
                'configured' => (bool) $config->id,
                'fromEmail' => $config->from_email,
                'fromName' => $config->from_name,
                'inboundHost' => $config->inbound_host,
                'isActive' => (bool) $config->is_active,
                'verifiedAt' => $config->verified_at,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_key' => ['required', 'string', 'min:16'],
            'webhook_verify_key' => ['nullable', 'string'],
            'from_email' => ['required', 'email', 'max:160'],
            'from_name' => ['nullable', 'string', 'max:120'],
            'inbound_host' => ['nullable', 'string', 'max:160'],
        ]);

        MailConfig::query()->update(['is_active' => false]);
        $config = MailConfig::create([
            'user_id' => $request->user()->id,
            'api_key' => $validated['api_key'],
            'webhook_verify_key' => $validated['webhook_verify_key'] ?? null,
            'from_email' => $validated['from_email'],
            'from_name' => $validated['from_name'] ?? null,
            'inbound_host' => $validated['inbound_host'] ?? null,
            'is_active' => true,
            'verified_at' => now(),
        ]);

        return response()->json([
            'config' => [
                'configured' => true,
                'fromEmail' => $config->from_email,
                'fromName' => $config->from_name,
                'inboundHost' => $config->inbound_host,
                'isActive' => true,
                'verifiedAt' => $config->verified_at,
            ],
        ], 201);
    }
}
