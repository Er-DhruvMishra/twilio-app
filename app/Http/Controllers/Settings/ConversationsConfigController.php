<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\ConversationsConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationsConfigController extends Controller
{
    public function show(): JsonResponse
    {
        $c = ConversationsConfig::active() ?? new ConversationsConfig();
        return response()->json([
            'config' => [
                'configured' => (bool) $c->id,
                'serviceSid' => $c->service_sid,
                'rcsAgentSid' => $c->rcs_agent_sid,
                'whatsappFrom' => $c->whatsapp_from,
                'facebookPageId' => $c->facebook_page_id,
                'chatEnabled' => (bool) $c->chat_enabled,
                'rcsEnabled' => (bool) $c->rcs_enabled,
                'whatsappEnabled' => (bool) $c->whatsapp_enabled,
                'facebookEnabled' => (bool) $c->facebook_enabled,
                'isActive' => (bool) $c->is_active,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_sid' => ['required', 'string', 'max:64'],
            'rcs_agent_sid' => ['nullable', 'string', 'max:80'],
            'whatsapp_from' => ['nullable', 'string', 'max:32'],
            'facebook_page_id' => ['nullable', 'string', 'max:120'],
            'chat_enabled' => ['boolean'],
            'rcs_enabled' => ['boolean'],
            'whatsapp_enabled' => ['boolean'],
            'facebook_enabled' => ['boolean'],
        ]);

        ConversationsConfig::query()->update(['is_active' => false]);
        $c = ConversationsConfig::create(array_merge($validated, [
            'user_id' => $request->user()->id,
            'is_active' => true,
        ]));

        return response()->json(['ok' => true, 'config' => $c], 201);
    }
}
