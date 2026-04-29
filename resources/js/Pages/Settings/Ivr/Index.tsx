import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Flow {
    id: number;
    name: string;
    isPublished: boolean;
    nodeCount: number | null;
    entryNodeId: number | null;
    createdAt: string;
}

export default function IvrIndex() {
    const [flows, setFlows] = useState<Flow[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/ivr-flows');
            setFlows(r.data.flows);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const create = async () => {
        if (!name.trim()) return;
        setBusy(true);
        try {
            const r = await axios.post('/api/ivr-flows', { name: name.trim() });
            router.visit(route('settings.ivr.editor', r.data.flow.id));
        } finally { setBusy(false); }
    };

    const remove = async (id: number) => {
        if (!confirm('Delete this flow and all its nodes?')) return;
        await axios.delete(`/api/ivr-flows/${id}`);
        load();
    };

    const togglePublish = async (f: Flow) => {
        await axios.put(`/api/ivr-flows/${f.id}`, { is_published: !f.isPublished });
        load();
    };

    return (
        <AppFrame title="IVR Flows" back={route('settings.index')}>
            <Head title="IVR Flows" />

            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 mb-4">
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">New flow</div>
                <div className="flex items-center gap-2">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Main menu, After hours, …"
                        className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    <button
                        type="button"
                        onClick={create}
                        disabled={busy || !name.trim()}
                        className="bg-blue-500 text-white rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        Create
                    </button>
                </div>
            </div>

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && flows.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">No IVR flows yet.</div>
            )}

            <div className="space-y-1.5">
                {flows.map((f) => (
                    <div key={f.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <Link href={route('settings.ivr.editor', f.id)} className="flex-1 min-w-0 active:opacity-70">
                                <div className="text-sm text-white font-medium truncate flex items-center gap-1.5">
                                    {f.name}
                                    {f.isPublished && <span className="text-[10px] uppercase font-semibold tracking-wide text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">live</span>}
                                </div>
                                <div className="text-xs text-slate-400">
                                    {f.nodeCount ?? 0} {f.nodeCount === 1 ? 'node' : 'nodes'}
                                    {!f.entryNodeId && <span className="text-amber-400 ml-2">⚠ no entry node</span>}
                                </div>
                            </Link>
                            <button type="button" onClick={() => togglePublish(f)} className="text-xs text-sky-400 px-2 py-1 active:opacity-70 shrink-0">
                                {f.isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                            <button type="button" onClick={() => remove(f.id)} className="text-xs text-rose-300 px-2 py-1 active:opacity-70 shrink-0">
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}
