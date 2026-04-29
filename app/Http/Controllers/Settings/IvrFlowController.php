<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\IvrFlow;
use App\Models\IvrNode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class IvrFlowController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $flows = IvrFlow::where('user_id', $request->user()->id)
            ->withCount('nodes')
            ->orderByDesc('id')
            ->get()
            ->map(fn (IvrFlow $f) => $this->transform($f));

        return response()->json(['flows' => $flows]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $flow = IvrFlow::with('nodes')
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        return response()->json([
            'flow' => $this->transform($flow),
            'nodes' => $flow->nodes->map(fn (IvrNode $n) => $this->transformNode($n)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
        ]);
        $flow = IvrFlow::create([
            'user_id' => $request->user()->id,
            'name' => $validated['name'],
            'is_published' => false,
            'version' => 1,
        ]);
        return response()->json(['flow' => $this->transform($flow)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $flow = IvrFlow::where('user_id', $request->user()->id)->findOrFail($id);
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'is_published' => ['sometimes', 'boolean'],
            'entry_node_id' => ['nullable', 'integer'],
            'assigned_phone_numbers' => ['nullable', 'array'],
        ]);
        $flow->update($validated);
        return response()->json(['flow' => $this->transform($flow->fresh())]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $flow = IvrFlow::where('user_id', $request->user()->id)->findOrFail($id);
        DB::transaction(function () use ($flow) {
            $flow->nodes()->delete();
            $flow->delete();
        });
        return response()->json(['ok' => true]);
    }

    /** Replaces the whole graph in a single transaction (matches what React Flow saves). */
    public function saveGraph(Request $request, int $id): JsonResponse
    {
        $flow = IvrFlow::where('user_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'entry_node_id' => ['nullable'],
            'nodes' => ['required', 'array'],
            'nodes.*.client_id' => ['required', 'string'],
            'nodes.*.id' => ['nullable', 'integer'],
            'nodes.*.type' => ['required', 'in:say,play,gather,dial,record,voicemail,hangup,goto,condition,queue,transfer'],
            'nodes.*.config' => ['nullable', 'array'],
            'nodes.*.position_x' => ['integer'],
            'nodes.*.position_y' => ['integer'],
            'edges' => ['nullable', 'array'],
            'edges.*.source_client_id' => ['required', 'string'],
            'edges.*.target_client_id' => ['required', 'string'],
            'edges.*.label' => ['nullable', 'string'],
        ]);

        $clientToServerId = [];

        DB::transaction(function () use ($flow, $validated, &$clientToServerId) {
            $existing = $flow->nodes()->get()->keyBy('id');
            $seen = [];

            // Upsert nodes
            foreach ($validated['nodes'] as $node) {
                if (!empty($node['id']) && $existing->has($node['id'])) {
                    $model = $existing->get($node['id']);
                    $model->update([
                        'type' => $node['type'],
                        'config' => $node['config'] ?? [],
                        'position_x' => $node['position_x'] ?? 0,
                        'position_y' => $node['position_y'] ?? 0,
                    ]);
                } else {
                    $model = $flow->nodes()->create([
                        'type' => $node['type'],
                        'config' => $node['config'] ?? [],
                        'position_x' => $node['position_x'] ?? 0,
                        'position_y' => $node['position_y'] ?? 0,
                    ]);
                }
                $clientToServerId[$node['client_id']] = $model->id;
                $seen[$model->id] = true;
            }

            // Drop nodes the editor no longer has
            foreach ($existing as $id => $node) {
                if (!isset($seen[$id])) $node->delete();
            }

            // Resolve edges → write next_node_id / branches into node configs
            // Reload nodes to get fresh configs
            $flow->load('nodes');
            $byId = $flow->nodes->keyBy('id');

            foreach ($validated['edges'] ?? [] as $edge) {
                $sourceId = $clientToServerId[$edge['source_client_id']] ?? null;
                $targetId = $clientToServerId[$edge['target_client_id']] ?? null;
                if (!$sourceId || !$targetId) continue;

                $source = $byId->get($sourceId);
                if (!$source) continue;
                $cfg = $source->config ?? [];

                if ($source->type === 'gather' || $source->type === 'condition') {
                    $branches = $cfg['branches'] ?? [];
                    $branches[] = [
                        'digits' => (string) ($edge['label'] ?? ''),
                        'target_node_id' => $targetId,
                    ];
                    $cfg['branches'] = $branches;
                } else {
                    $cfg['next_node_id'] = $targetId;
                }
                $source->update(['config' => $cfg]);
            }

            // Resolve entry node id
            $entryClientId = $validated['entry_node_id'] ?? null;
            if ($entryClientId && isset($clientToServerId[$entryClientId])) {
                $flow->update(['entry_node_id' => $clientToServerId[$entryClientId]]);
            } elseif (!$flow->entry_node_id && $flow->nodes->isNotEmpty()) {
                $flow->update(['entry_node_id' => $flow->nodes->first()->id]);
            }
        });

        return $this->show($request, $flow->id);
    }

    private function transform(IvrFlow $f): array
    {
        return [
            'id' => $f->id,
            'name' => $f->name,
            'isPublished' => (bool) $f->is_published,
            'version' => (int) $f->version,
            'entryNodeId' => $f->entry_node_id,
            'assignedPhoneNumbers' => $f->assigned_phone_numbers ?? [],
            'nodeCount' => $f->nodes_count ?? null,
            'createdAt' => $f->created_at,
        ];
    }

    private function transformNode(IvrNode $n): array
    {
        return [
            'id' => $n->id,
            'type' => $n->type,
            'config' => $n->config ?? [],
            'positionX' => (int) $n->position_x,
            'positionY' => (int) $n->position_y,
        ];
    }
}
