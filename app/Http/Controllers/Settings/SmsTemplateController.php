<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\SmsTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmsTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $templates = SmsTemplate::where('user_id', $request->user()->id)
            ->orderBy('name')
            ->get()
            ->map(fn (SmsTemplate $t) => $this->transform($t));

        return response()->json(['templates' => $templates]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateInput($request);
        $tpl = SmsTemplate::create([
            'user_id' => $request->user()->id,
            ...$validated,
            'variables' => $validated['variables'] ?? self::extractVariables($validated['body']),
        ]);
        return response()->json(['template' => $this->transform($tpl)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $tpl = SmsTemplate::where('user_id', $request->user()->id)->findOrFail($id);
        $validated = $this->validateInput($request);
        $tpl->update([
            ...$validated,
            'variables' => $validated['variables'] ?? self::extractVariables($validated['body']),
        ]);
        return response()->json(['template' => $this->transform($tpl->fresh())]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        SmsTemplate::where('user_id', $request->user()->id)->findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    private function validateInput(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'body' => ['required', 'string', 'max:1600'],
            'variables' => ['nullable', 'array'],
            'variables.*' => ['string'],
        ]);
    }

    private function transform(SmsTemplate $t): array
    {
        return [
            'id' => $t->id,
            'name' => $t->name,
            'body' => $t->body,
            'variables' => $t->variables ?? [],
            'createdAt' => $t->created_at,
        ];
    }

    public static function extractVariables(string $body): array
    {
        preg_match_all('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', $body, $matches);
        return array_values(array_unique($matches[1] ?? []));
    }
}
