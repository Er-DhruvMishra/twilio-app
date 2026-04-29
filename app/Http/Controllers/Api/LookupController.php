<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lookup;
use App\Services\Twilio\LookupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LookupController extends Controller
{
    public function __construct(private LookupService $lookups) {}

    /** Manual lookup. Source restricted to the manually-driven enum values. */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'starts_with:+', 'max:32'],
            'source' => ['required', 'in:manual_search,incoming_manual,outgoing_manual'],
        ]);

        $user = $request->user();
        $row = $this->lookups->lookup($validated['phone'], $validated['source'], $user);

        return response()->json([
            'lookup' => $this->transform($row),
        ], 201);
    }

    /**
     * Outbound pre-dial check. Frontend calls this just before dialing —
     * server decides whether to actually fire a lookup based on user's
     * auto-toggle + contact-existence. Returns null when no lookup ran.
     */
    public function preDial(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'starts_with:+', 'max:32'],
        ]);

        $user = $request->user();
        if (!$this->lookups->shouldAutoLookupOutbound($user, $validated['phone'])) {
            return response()->json(['lookup' => null]);
        }

        $row = $this->lookups->lookup($validated['phone'], 'outgoing_auto', $user);
        return response()->json(['lookup' => $this->transform($row)]);
    }

    /** History list. Admin sees all lookups; agents see only their own. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $sourceFilter = $request->query('source');
        $phone = $request->query('phone');

        $query = Lookup::with('requestedBy:id,name')->orderByDesc('looked_up_at');
        if (!$user->isAdmin()) {
            $query->where('requested_by_user_id', $user->id);
        }
        if ($sourceFilter && in_array($sourceFilter, LookupService::SOURCES, true)) {
            $query->where('source', $sourceFilter);
        }
        if ($phone) {
            $query->where('phone_e164', 'like', '%' . trim((string) $phone) . '%');
        }

        $rows = $query->limit(200)->get();

        return response()->json([
            'lookups' => $rows->map(fn (Lookup $r) => $this->transform($r, includeRequester: $user->isAdmin())),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $query = Lookup::with('requestedBy:id,name');
        if (!$user->isAdmin()) {
            $query->where('requested_by_user_id', $user->id);
        }
        $row = $query->findOrFail($id);
        return response()->json(['lookup' => $this->transform($row, includeRequester: true, includePayload: true)]);
    }

    private function transform(Lookup $r, bool $includeRequester = false, bool $includePayload = false): array
    {
        return [
            'id' => $r->id,
            'phone' => $r->phone_e164,
            'callerName' => $r->caller_name,
            'callerType' => $r->caller_type,
            'lineType' => $r->line_type,
            'carrierName' => $r->carrier_name,
            'countryCode' => $r->country_code,
            'isValid' => (bool) $r->is_valid,
            'source' => $r->source,
            'costCents' => (int) $r->cost_cents,
            'lookedUpAt' => $r->looked_up_at,
            'requester' => $includeRequester && $r->requestedBy ? [
                'id' => $r->requestedBy->id,
                'name' => $r->requestedBy->name,
            ] : null,
            'payload' => $includePayload ? $r->payload : null,
        ];
    }
}
