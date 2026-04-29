import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Rule {
    id: number;
    name: string;
    priority: number;
    isEnabled: boolean;
    matchType: string;
    action: string;
}

export default function RoutingIndex() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/routing-rules');
            setRules(r.data.rules);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const create = async () => {
        const r = await axios.post('/api/routing-rules', {
            name: 'New rule',
            priority: 100,
            is_enabled: false,
            match_type: 'any',
            action: 'ring_user',
            action_target: { user_ids: [] },
        });
        router.visit(route('settings.routing.edit', r.data.rule.id));
    };

    const remove = async (id: number) => {
        if (!confirm('Delete this rule?')) return;
        await axios.delete(`/api/routing-rules/${id}`);
        load();
    };

    return (
        <AppFrame
            title="Routing Rules"
            back={route('settings.index')}
            actions={
                <button type="button" onClick={create} className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60">
                    Add
                </button>
            }
        >
            <Head title="Routing Rules" />

            <p className="text-xs text-slate-400 px-1 mb-2 leading-snug">
                Inbound calls flow through these in priority order (lower number = higher priority). The first rule whose match conditions and time window are satisfied wins.
            </p>

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && rules.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">
                    No rules. <button type="button" onClick={create} className="text-sky-400">Create your first one →</button>
                </div>
            )}

            <div className="space-y-1.5">
                {rules.map((r) => (
                    <div key={r.id} className={`rounded-xl border p-3 ${r.isEnabled ? 'bg-white/5 border-white/10' : 'bg-white/5 border-white/10 opacity-50'}`}>
                        <div className="flex items-start gap-3">
                            <div className="text-[10px] text-slate-400 font-mono w-8 text-right pt-0.5">{r.priority}</div>
                            <Link
                                href={route('settings.routing.edit', r.id)}
                                className="flex-1 min-w-0 active:opacity-70"
                            >
                                <div className="text-sm text-white font-medium truncate flex items-center gap-1.5">
                                    {!r.isEnabled && <span className="text-[10px] uppercase font-semibold tracking-wide text-slate-400 bg-white/5 border border-white/10 px-1 rounded">disabled</span>}
                                    {r.name}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                    Match: <span className="font-mono">{r.matchType}</span> → action: <span className="font-mono">{r.action}</span>
                                </div>
                            </Link>
                            <button type="button" onClick={() => remove(r.id)} className="text-xs text-rose-300 px-2 py-1 active:opacity-70 shrink-0">
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}
