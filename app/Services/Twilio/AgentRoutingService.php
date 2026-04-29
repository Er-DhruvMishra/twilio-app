<?php

namespace App\Services\Twilio;

use App\Models\Call;
use App\Models\RoutingRule;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Decides which agent to ring for a routing rule.
 *
 * Strategies (driven by RoutingRule.action):
 *  - ring_user            single fixed user
 *  - simultaneous_ring    target.user_ids[] all ring at once
 *  - round_robin          rotate through eligible users; persist cursor on rule
 *  - priority_list        ordered list, ring first available
 *  - skill_based          match rule.match_value.skills[] against user.skills
 */
class AgentRoutingService
{
    /**
     * @return Collection<int, User>  Ordered list of users to ring (one or many).
     */
    public function selectAgents(RoutingRule $rule): Collection
    {
        $candidates = $this->candidatesFor($rule);
        $available = $candidates->filter(fn (User $u) => $this->isAvailable($u))->values();

        // If no one is "available", fall back to the full candidate list — better
        // to ring someone who's idle than to drop the call.
        $pool = $available->isNotEmpty() ? $available : $candidates;

        return match ($rule->action) {
            'ring_user' => $pool->take(1),
            'simultaneous_ring' => $pool,
            'priority_list' => $pool->take(1),
            'round_robin' => $this->advanceRoundRobin($rule, $pool),
            'skill_based' => $this->rankBySkills($rule, $pool)->take(1),
            default => $pool->take(1),
        };
    }

    private function candidatesFor(RoutingRule $rule): Collection
    {
        $target = $rule->action_target ?? [];
        $userIds = collect($target['user_ids'] ?? [])->filter()->map(fn ($v) => (int) $v);

        if ($userIds->isEmpty()) {
            // Fall back to all users with the agent or admin role.
            return User::role(['admin', 'agent'])->get();
        }

        // Preserve the order the admin chose for priority_list.
        $users = User::whereIn('id', $userIds)->get()->keyBy('id');
        return $userIds->map(fn ($id) => $users->get($id))->filter()->values();
    }

    private function isAvailable(User $user): bool
    {
        if ($user->presence !== 'available') return false;
        return Call::where('user_id', $user->id)
            ->whereIn('status', ['ringing', 'in-progress'])
            ->doesntExist();
    }

    private function advanceRoundRobin(RoutingRule $rule, Collection $pool): Collection
    {
        if ($pool->isEmpty()) return $pool;

        $lastId = (int) ($rule->last_assigned_user_id ?? 0);
        $ids = $pool->pluck('id')->all();
        $i = array_search($lastId, $ids, true);
        $next = $pool->get($i === false ? 0 : (($i + 1) % count($ids)));

        if ($next) {
            $rule->update(['last_assigned_user_id' => $next->id]);
            return collect([$next]);
        }
        return $pool->take(1);
    }

    private function rankBySkills(RoutingRule $rule, Collection $pool): Collection
    {
        $required = collect($rule->match_value['skills'] ?? [])->map(fn ($s) => strtolower((string) $s));
        if ($required->isEmpty()) return $pool;

        return $pool
            ->map(function (User $u) use ($required) {
                $userSkills = collect($u->skills ?? [])->map(fn ($s) => strtolower((string) $s));
                $hits = $required->intersect($userSkills)->count();
                return ['user' => $u, 'hits' => $hits];
            })
            ->sortByDesc('hits')
            ->pluck('user')
            ->values();
    }
}
