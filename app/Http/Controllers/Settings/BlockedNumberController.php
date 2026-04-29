<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\BlockedNumber;
use App\Services\Contacts\PhoneNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BlockedNumberController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rules = BlockedNumber::where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (BlockedNumber $r) => $this->transform($r));

        return response()->json(['rules' => $rules]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mode' => ['required', 'in:blacklist,whitelist'],
            'pattern_type' => ['required', 'in:exact,prefix,country'],
            'pattern_value' => ['required', 'string', 'max:32'],
            'reason' => ['nullable', 'string', 'max:200'],
        ]);

        $value = $validated['pattern_value'];
        $e164 = $value;
        if ($validated['pattern_type'] === 'exact') {
            [$e164] = PhoneNormalizer::normalize($value);
        }

        $rule = BlockedNumber::create([
            'user_id' => $request->user()->id,
            'mode' => $validated['mode'],
            'pattern_type' => $validated['pattern_type'],
            'pattern_value' => $value,
            'phone_e164' => $e164,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json(['rule' => $this->transform($rule)], 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        BlockedNumber::where('user_id', $request->user()->id)->findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    private function transform(BlockedNumber $r): array
    {
        return [
            'id' => $r->id,
            'mode' => $r->mode,
            'patternType' => $r->pattern_type,
            'patternValue' => $r->pattern_value,
            'phoneE164' => $r->phone_e164,
            'reason' => $r->reason,
            'createdAt' => $r->created_at,
        ];
    }
}
