<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\AutoReplyRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AutoReplyRuleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rules = AutoReplyRule::where('user_id', $request->user()->id)
            ->orderBy('priority')
            ->orderByDesc('id')
            ->get()
            ->map(fn (AutoReplyRule $r) => $this->transform($r));

        return response()->json(['rules' => $rules]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateInput($request);
        $rule = AutoReplyRule::create([
            'user_id' => $request->user()->id,
            ...$validated,
        ]);
        return response()->json(['rule' => $this->transform($rule)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $rule = AutoReplyRule::where('user_id', $request->user()->id)->findOrFail($id);
        $rule->update($this->validateInput($request));
        return response()->json(['rule' => $this->transform($rule->fresh())]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        AutoReplyRule::where('user_id', $request->user()->id)->findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    private function validateInput(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'match_type' => ['required', 'in:always,keyword,first_contact,outside_hours'],
            'match_value' => ['nullable', 'array'],
            'body' => ['required', 'string', 'max:1600'],
            'is_enabled' => ['boolean'],
            'priority' => ['integer', 'min:0', 'max:1000'],
        ]);
    }

    private function transform(AutoReplyRule $r): array
    {
        return [
            'id' => $r->id,
            'name' => $r->name,
            'matchType' => $r->match_type,
            'matchValue' => $r->match_value ?? [],
            'body' => $r->body,
            'isEnabled' => (bool) $r->is_enabled,
            'priority' => (int) $r->priority,
        ];
    }
}
