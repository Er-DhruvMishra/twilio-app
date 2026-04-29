<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\RoutingRule;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoutingRuleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rules = RoutingRule::where('user_id', $request->user()->id)
            ->orderBy('priority')
            ->orderBy('id')
            ->get()
            ->map(fn (RoutingRule $r) => $this->transform($r));

        $agents = User::role(['admin', 'agent'])->get(['id', 'name', 'email', 'presence']);

        return response()->json([
            'rules' => $rules,
            'agents' => $agents,
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $rule = RoutingRule::where('user_id', $request->user()->id)->findOrFail($id);
        return response()->json(['rule' => $this->transform($rule)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateInput($request);
        $rule = RoutingRule::create([
            'user_id' => $request->user()->id,
            ...$validated,
        ]);
        return response()->json(['rule' => $this->transform($rule)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $rule = RoutingRule::where('user_id', $request->user()->id)->findOrFail($id);
        $rule->update($this->validateInput($request));
        return response()->json(['rule' => $this->transform($rule->fresh())]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        RoutingRule::where('user_id', $request->user()->id)->findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    private function validateInput(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'priority' => ['integer', 'min:0', 'max:1000'],
            'is_enabled' => ['boolean'],
            'match_type' => ['required', 'in:any,contact_tag,number_pattern,time_window,from_country'],
            'match_value' => ['nullable', 'array'],
            'action' => ['required', 'in:ring_user,simultaneous_ring,round_robin,priority_list,skill_based,forward,voicemail,ivr,queue'],
            'action_target' => ['nullable', 'array'],
            'time_window' => ['nullable', 'array'],
        ]);
    }

    private function transform(RoutingRule $r): array
    {
        return [
            'id' => $r->id,
            'name' => $r->name,
            'priority' => (int) $r->priority,
            'isEnabled' => (bool) $r->is_enabled,
            'matchType' => $r->match_type,
            'matchValue' => $r->match_value ?? [],
            'action' => $r->action,
            'actionTarget' => $r->action_target ?? [],
            'timeWindow' => $r->time_window ?? [],
            'lastAssignedUserId' => $r->last_assigned_user_id,
        ];
    }
}
