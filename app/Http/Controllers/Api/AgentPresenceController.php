<?php

namespace App\Http\Controllers\Api;

use App\Events\AgentPresenceChanged;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentPresenceController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'presence' => ['required', 'in:available,busy,away,offline'],
        ]);
        $user = $request->user();
        $user->update([
            'presence' => $validated['presence'],
            'last_seen_at' => now(),
        ]);
        AgentPresenceChanged::dispatch($user->fresh());
        return response()->json(['ok' => true, 'presence' => $user->presence]);
    }

    public function heartbeat(Request $request): JsonResponse
    {
        $request->user()->update(['last_seen_at' => now()]);
        return response()->json(['ok' => true]);
    }

    public function setSkills(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'skills' => ['required', 'array'],
            'skills.*' => ['string', 'max:32'],
        ]);
        $request->user()->update(['skills' => array_values(array_unique($validated['skills']))]);
        return response()->json(['ok' => true, 'skills' => $request->user()->skills]);
    }
}
