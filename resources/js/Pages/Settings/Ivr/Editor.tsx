import { Head, Link } from '@inertiajs/react';
import {
    ReactFlow,
    Background,
    Controls,
    addEdge,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type Connection,
    Handle,
    Position,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface IvrNodeRow {
    id: number;
    type: NodeType;
    config: Record<string, unknown>;
    positionX: number;
    positionY: number;
}
interface IvrFlow {
    id: number;
    name: string;
    isPublished: boolean;
    entryNodeId: number | null;
}

type NodeType = 'say' | 'play' | 'gather' | 'dial' | 'record' | 'voicemail' | 'hangup' | 'goto' | 'condition' | 'queue' | 'transfer';

interface Props { flowId: number }

const NODE_TYPES: Array<{ type: NodeType; label: string; color: string; description: string }> = [
    { type: 'say', label: 'Say', color: 'bg-blue-500', description: 'TTS prompt' },
    { type: 'play', label: 'Play', color: 'bg-blue-500', description: 'Play audio URL' },
    { type: 'gather', label: 'Gather', color: 'bg-amber-500', description: 'DTMF / speech menu' },
    { type: 'dial', label: 'Dial', color: 'bg-emerald-500', description: 'Bridge to number' },
    { type: 'record', label: 'Record', color: 'bg-rose-500', description: 'Capture audio' },
    { type: 'voicemail', label: 'Voicemail', color: 'bg-rose-500', description: 'Record + transcribe' },
    { type: 'queue', label: 'Queue', color: 'bg-violet-500', description: 'Hold queue' },
    { type: 'goto', label: 'Goto', color: 'bg-slate-500', description: 'Jump to node' },
    { type: 'hangup', label: 'Hangup', color: 'bg-slate-700', description: 'End the call' },
];

export default function IvrEditor({ flowId }: Props) {
    return (
        <ReactFlowProvider>
            <Editor flowId={flowId} />
        </ReactFlowProvider>
    );
}

function Editor({ flowId }: Props) {
    const [flow, setFlow] = useState<IvrFlow | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [entryClientId, setEntryClientId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const nodeTypes = useMemo(() => ({ ivr: IvrNodeView }), []);

    useEffect(() => {
        axios.get(`/api/ivr-flows/${flowId}`).then((r) => {
            const f = r.data.flow as IvrFlow;
            const dbNodes = r.data.nodes as IvrNodeRow[];
            setFlow(f);

            const idToClient = new Map<number, string>();
            const initialNodes: Node[] = dbNodes.map((n) => {
                const cid = `n${n.id}`;
                idToClient.set(n.id, cid);
                return {
                    id: cid,
                    type: 'ivr',
                    position: { x: n.positionX, y: n.positionY },
                    data: { dbId: n.id, type: n.type, config: n.config ?? {}, isEntry: n.id === f.entryNodeId },
                };
            });

            const initialEdges: Edge[] = [];
            dbNodes.forEach((n) => {
                const cid = idToClient.get(n.id);
                if (!cid) return;
                if (n.type === 'gather' || n.type === 'condition') {
                    const branches = ((n.config as { branches?: Array<{ digits?: string; target_node_id?: number }> }).branches) ?? [];
                    branches.forEach((b, idx) => {
                        const tgt = b.target_node_id && idToClient.get(b.target_node_id);
                        if (tgt) initialEdges.push({ id: `e${cid}-${tgt}-${idx}`, source: cid, target: tgt, label: b.digits ?? '' });
                    });
                } else {
                    const next = (n.config as { next_node_id?: number }).next_node_id;
                    const tgt = next && idToClient.get(next);
                    if (tgt) initialEdges.push({ id: `e${cid}-${tgt}`, source: cid, target: tgt });
                }
            });

            setNodes(initialNodes);
            setEdges(initialEdges);
            if (f.entryNodeId) setEntryClientId(idToClient.get(f.entryNodeId) ?? null);
        });
    }, [flowId, setNodes, setEdges]);

    const onConnect = useCallback((params: Edge | Connection) => {
        const label = window.prompt('Edge label (e.g., "1" for digit one — leave blank for unconditional next):', '') ?? '';
        setEdges((eds) => {
            const newEdges = addEdge(params, eds);
            // addEdge returns the array with the new edge appended; tag the new one with the label.
            return newEdges.map((e, i) => (i === newEdges.length - 1 ? { ...e, label } : e));
        });
    }, [setEdges]);

    const addNode = (type: NodeType) => {
        const id = `n_new_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const node: Node = {
            id,
            type: 'ivr',
            position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
            data: { dbId: null, type, config: defaultConfig(type), isEntry: false },
        };
        setNodes((nds) => [...nds, node]);
        setSelectedId(id);
    };

    const updateSelectedConfig = (patch: Record<string, unknown>) => {
        if (!selectedId) return;
        setNodes((nds) => nds.map((n) => n.id === selectedId
            ? { ...n, data: { ...n.data, config: { ...((n.data as { config?: Record<string, unknown> }).config ?? {}), ...patch } } }
            : n
        ));
    };
    const removeSelected = () => {
        if (!selectedId) return;
        if (!confirm('Delete this node?')) return;
        setNodes((nds) => nds.filter((n) => n.id !== selectedId));
        setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
        if (entryClientId === selectedId) setEntryClientId(null);
        setSelectedId(null);
    };
    const setEntry = () => {
        if (!selectedId) return;
        setEntryClientId(selectedId);
        setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, isEntry: n.id === selectedId } })));
    };

    const save = async () => {
        setSaving(true); setMessage(null);
        try {
            const payload = {
                entry_node_id: entryClientId,
                nodes: nodes.map((n) => ({
                    client_id: n.id,
                    id: (n.data as { dbId: number | null }).dbId,
                    type: (n.data as { type: NodeType }).type,
                    config: cleanConfig((n.data as { config: Record<string, unknown> }).config),
                    position_x: Math.round(n.position.x),
                    position_y: Math.round(n.position.y),
                })),
                edges: edges.map((e) => ({
                    source_client_id: e.source,
                    target_client_id: e.target,
                    label: typeof e.label === 'string' ? e.label : '',
                })),
            };
            await axios.post(`/api/ivr-flows/${flowId}/graph`, payload);
            setMessage('Saved.');
            setTimeout(() => setMessage(null), 2000);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setMessage(err.response?.data?.message ?? 'Save failed.');
        } finally { setSaving(false); }
    };

    const selected = nodes.find((n) => n.id === selectedId) ?? null;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <Head title={flow ? `IVR — ${flow.name}` : 'IVR'} />

            <header className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-slate-900">
                <div className="flex items-center gap-3 min-w-0">
                    <Link href={route('settings.ivr')} className="text-sky-400 text-sm">← Back</Link>
                    <div className="text-sm font-semibold truncate">{flow?.name ?? '…'}</div>
                </div>
                <div className="flex items-center gap-2">
                    {message && <span className="text-xs text-emerald-300">{message}</span>}
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="bg-blue-500 text-white rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-[180px_1fr_300px] h-[calc(100vh-44px)]">
                <aside className="border-r border-white/10 bg-slate-900 p-3 space-y-2 overflow-y-auto">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Add node</div>
                    {NODE_TYPES.map((t) => (
                        <button
                            key={t.type}
                            type="button"
                            onClick={() => addNode(t.type)}
                            className="w-full flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 active:bg-white/10 text-left"
                        >
                            <span className={`w-2 h-2 rounded-full ${t.color}`} />
                            <span className="flex-1 min-w-0">
                                <div className="text-sm text-white">{t.label}</div>
                                <div className="text-[10px] text-slate-400 truncate">{t.description}</div>
                            </span>
                        </button>
                    ))}
                </aside>

                <main className="bg-slate-900/40">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={(_, n) => setSelectedId(n.id)}
                        onPaneClick={() => setSelectedId(null)}
                        nodeTypes={nodeTypes}
                        fitView
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background gap={16} color="#1e293b" />
                        <Controls />
                    </ReactFlow>
                </main>

                <aside className="border-l border-white/10 bg-slate-900 p-3 overflow-y-auto">
                    {!selected && (
                        <div className="text-xs text-slate-400 leading-relaxed">
                            Click a node to edit. Drag from a node's right edge to another node's left edge to wire them up. For <span className="font-mono">gather</span> / <span className="font-mono">condition</span> nodes, the edge label is the digits/keyword that takes the call down that branch.
                        </div>
                    )}
                    {selected && (
                        <Inspector
                            node={selected}
                            isEntry={selected.id === entryClientId}
                            onUpdateConfig={updateSelectedConfig}
                            onSetEntry={setEntry}
                            onRemove={removeSelected}
                        />
                    )}
                </aside>
            </div>
        </div>
    );
}

function IvrNodeView({ data, selected }: { data: { type: NodeType; config: Record<string, unknown>; isEntry: boolean; dbId: number | null }; selected: boolean }) {
    const meta = NODE_TYPES.find((t) => t.type === data.type);
    return (
        <div className={`rounded-lg bg-slate-800 border ${selected ? 'border-blue-400' : 'border-white/15'} shadow-md min-w-[160px]`}>
            <Handle type="target" position={Position.Left} className="!bg-slate-500" />
            <div className={`px-2 py-1 text-[10px] uppercase tracking-wide font-semibold rounded-t-lg ${meta?.color ?? 'bg-slate-600'} text-white flex items-center justify-between`}>
                <span>{data.type}</span>
                {data.isEntry && <span className="bg-white/30 px-1 rounded">entry</span>}
            </div>
            <div className="px-2 py-2 text-xs text-slate-200 max-w-[220px] break-words">
                {summarize(data.type, data.config)}
            </div>
            <Handle type="source" position={Position.Right} className="!bg-slate-500" />
        </div>
    );
}

function summarize(type: NodeType, cfg: Record<string, unknown>): string {
    switch (type) {
        case 'say': return (cfg.text as string) || '(no text)';
        case 'play': return (cfg.url as string) || '(no audio URL)';
        case 'gather': return (cfg.prompt_text as string) || (cfg.prompt_audio_url as string) || '(no prompt)';
        case 'dial': return (cfg.to_e164 as string) || (cfg.client_identity as string) || '(no target)';
        case 'record': return `max ${(cfg.max_length as number) ?? 60}s`;
        case 'voicemail': return (cfg.greeting_text as string) || 'voicemail';
        case 'queue': return (cfg.queue_name as string) || 'support';
        case 'goto': return cfg.target_node_id ? `→ #${cfg.target_node_id}` : '(no target)';
        case 'hangup': return (cfg.text as string) || 'goodbye';
        default: return '';
    }
}

function defaultConfig(type: NodeType): Record<string, unknown> {
    switch (type) {
        case 'say': return { text: 'Hello, thanks for calling.' };
        case 'play': return { url: '' };
        case 'gather': return { prompt_text: 'Press 1 for sales, 2 for support.', num_digits: 1, timeout: 5 };
        case 'dial': return { to_e164: '', timeout: 20 };
        case 'record': return { max_length: 60, finish_on_key: '#' };
        case 'voicemail': return { greeting_text: 'Please leave a message after the beep.' };
        case 'queue': return { queue_name: 'support' };
        case 'goto': return { target_node_id: null };
        case 'hangup': return { text: 'Goodbye.' };
        default: return {};
    }
}

function cleanConfig(cfg: Record<string, unknown>): Record<string, unknown> {
    // Drop next_node_id / branches — those are derived from edges at save time on the server.
    const copy: Record<string, unknown> = { ...cfg };
    delete copy.next_node_id;
    delete copy.branches;
    return copy;
}

function Inspector({ node, isEntry, onUpdateConfig, onSetEntry, onRemove }: {
    node: Node;
    isEntry: boolean;
    onUpdateConfig: (patch: Record<string, unknown>) => void;
    onSetEntry: () => void;
    onRemove: () => void;
}) {
    const data = node.data as { type: NodeType; config: Record<string, unknown> };
    const cfg = data.config;

    const F = (label: string, key: string, placeholder?: string, isNum?: boolean) => (
        <label className="block">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{label}</div>
            <input
                value={String(cfg[key] ?? '')}
                onChange={(e) => onUpdateConfig({ [key]: isNum ? (Number(e.target.value) || 0) : e.target.value })}
                placeholder={placeholder}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-400"
            />
        </label>
    );

    return (
        <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Inspector — {data.type}</div>

            {data.type === 'say' && F('Text', 'text', 'Hello, thanks for calling.')}
            {data.type === 'say' && F('Voice (e.g. alice, Polly.Joanna)', 'voice')}
            {data.type === 'say' && F('Language (en-US, hi-IN, …)', 'language')}

            {data.type === 'play' && F('Audio URL', 'url', 'https://…')}

            {data.type === 'gather' && (
                <>
                    {F('Prompt text', 'prompt_text')}
                    {F('Prompt audio URL', 'prompt_audio_url')}
                    {F('Digits to gather', 'num_digits', '1', true)}
                    {F('Timeout (s)', 'timeout', '5', true)}
                    {F('Finish on key', 'finish_on_key', '#')}
                    <label className="flex items-center gap-2 text-sm text-white">
                        <input
                            type="checkbox"
                            checked={!!cfg.speech}
                            onChange={(e) => onUpdateConfig({ speech: e.target.checked })}
                            className="rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
                        />
                        Also accept speech
                    </label>
                </>
            )}

            {data.type === 'dial' && (
                <>
                    {F('Number (E.164)', 'to_e164', '+1 555…')}
                    {F('Or client identity', 'client_identity', 'user_42')}
                    {F('Timeout (s)', 'timeout', '20', true)}
                </>
            )}

            {data.type === 'record' && (
                <>
                    {F('Max length (s)', 'max_length', '60', true)}
                    {F('Finish on key', 'finish_on_key', '#')}
                    <label className="flex items-center gap-2 text-sm text-white">
                        <input
                            type="checkbox"
                            checked={!!cfg.transcribe}
                            onChange={(e) => onUpdateConfig({ transcribe: e.target.checked })}
                            className="rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
                        />
                        Transcribe
                    </label>
                </>
            )}

            {data.type === 'voicemail' && (
                <>
                    {F('Greeting text', 'greeting_text')}
                    {F('Greeting audio URL', 'greeting_url')}
                </>
            )}

            {data.type === 'queue' && F('Queue name', 'queue_name', 'support')}

            {data.type === 'goto' && F('Target node DB id', 'target_node_id', '', true)}

            {data.type === 'hangup' && F('Optional spoken text', 'text', 'Goodbye.')}

            <div className="border-t border-white/10 pt-3 space-y-2">
                <button
                    type="button"
                    onClick={onSetEntry}
                    disabled={isEntry}
                    className="w-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50 active:bg-emerald-500/30"
                >
                    {isEntry ? '✓ Flow entry' : 'Set as flow entry'}
                </button>
                <button
                    type="button"
                    onClick={onRemove}
                    className="w-full bg-rose-500/20 border border-rose-400/40 text-rose-200 rounded-lg py-1.5 text-xs font-semibold active:bg-rose-500/30"
                >
                    Delete node
                </button>
            </div>
        </div>
    );
}
