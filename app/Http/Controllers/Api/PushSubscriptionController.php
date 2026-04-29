<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Notifications\TestPushNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    public function vapid(): JsonResponse
    {
        return response()->json([
            'publicKey' => config('webpush.vapid.public_key'),
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => ['required', 'string', 'url'],
            'public_key' => ['required', 'string'],
            'auth_token' => ['required', 'string'],
            'content_encoding' => ['nullable', 'string'],
        ]);

        $request->user()->updatePushSubscription(
            $validated['endpoint'],
            $validated['public_key'],
            $validated['auth_token'],
            $validated['content_encoding'] ?? 'aesgcm',
        );

        return response()->json(['ok' => true]);
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => ['required', 'string'],
        ]);
        $request->user()->deletePushSubscription($validated['endpoint']);
        return response()->json(['ok' => true]);
    }

    public function test(Request $request): JsonResponse
    {
        $request->user()->notify(new TestPushNotification());
        return response()->json(['ok' => true]);
    }
}
