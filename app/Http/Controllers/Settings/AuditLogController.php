<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only viewer for the audit_logs table. Surfaces what `ScopedToUser`
 * + Team / Debug controllers have been logging — admin cross-user reads,
 * role + permission grants, debug flag flips, log clears.
 */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $action = trim((string) $request->query('action', ''));
        $userId = $request->query('user_id');
        $since = $request->query('since'); // ISO-ish "2026-04-28"

        $q = AuditLog::with('user:id,name')
            ->orderByDesc('created_at')
            ->limit(500);

        if ($action !== '') {
            $q->where('action', 'like', "%{$action}%");
        }
        if ($userId) {
            $q->where('user_id', (int) $userId);
        }
        if ($since) {
            try {
                $q->where('created_at', '>=', \Carbon\Carbon::parse($since)->startOfDay());
            } catch (\Throwable) { /* ignore bad input */ }
        }

        $rows = $q->get();

        // Distinct action prefixes for the filter dropdown ("view-as-admin",
        // "team", "debug" etc.) — cheap aggregation off the same table.
        $prefixes = AuditLog::query()
            ->selectRaw("DISTINCT SUBSTRING_INDEX(action, '.', 1) AS prefix")
            ->orderBy('prefix')
            ->pluck('prefix')
            ->filter()
            ->values();

        return response()->json([
            'logs' => $rows->map(fn (AuditLog $a) => [
                'id' => $a->id,
                'action' => $a->action,
                'entityType' => $a->entity_type,
                'entityId' => $a->entity_id,
                'payload' => $a->payload,
                'ip' => $a->ip,
                'createdAt' => $a->created_at,
                'actor' => $a->user ? ['id' => $a->user->id, 'name' => $a->user->name] : null,
            ]),
            'actionPrefixes' => $prefixes,
        ]);
    }
}
