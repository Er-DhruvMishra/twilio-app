<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Twilio\AccessTokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TwilioTokenController extends Controller
{
    public function __construct(private AccessTokenService $tokens) {}

    public function issue(Request $request): JsonResponse
    {
        try {
            $data = $this->tokens->issueFor($request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        return response()->json($data);
    }
}
