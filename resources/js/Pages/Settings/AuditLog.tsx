import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface LogRow {
    id: number;
    action: string;
    entityType: string | null;
    entityId: number | null;
    payload: Record<string, unknown> | null;
    ip: string | null;
    createdAt: string;
    actor: { id: number; name: string } | null;
}

export default function AuditLogIndex() {
    const [rows, setRows] = useState<LogRow[]>([]);
    const [prefixes, setPrefixes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState('');
    const [openId, setOpenId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/settings/audit-log', {
                params: { action: actionFilter || undefined },
            });
            setRows(r.data.logs);
            setPrefixes(r.data.actionPrefixes);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [actionFilter]);

    return (
        <AppFrame title="Audit log" back={route('settings.index')}>
            <Head title="Audit log" />

            <div className="rounded-2xl bg-amber-500/5 border border-amber-400/20 p-3 text-amber-200 text-xs leading-relaxed mb-4">
                Tracks admin cross-user reads, role + permission changes, and debug flag flips.
                Logs are append-only and not user-deletable.
            </div>

            <div className="flex gap-1.5 mb-3 overflow-x-auto -mx-1 px-1 no-scrollbar">
                <Pill active={actionFilter === ''} onClick={() => setActionFilter('')}>All</Pill>
                {prefixes.map((p) => (
                    <Pill key={p} active={actionFilter === p} onClick={() => setActionFilter(p)}>{p}</Pill>
                ))}
            </div>

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && rows.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">No audit events match.</div>
            )}

            <div className="space-y-1">
                {rows.map((r) => (
                    <div key={r.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setOpenId((p) => p === r.id ? null : r.id)}
                            className="w-full text-left px-3 py-2 active:bg-white/10"
                        >
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${actionColor(r.action)}`}>
                                    {r.action}
                                </span>
                                <span className="text-xs text-slate-400">
                                    {r.actor?.name ?? <span className="italic">system</span>}
                                </span>
                                <span className="text-[10px] text-slate-500 ml-auto">{relativeTime(r.createdAt)}</span>
                            </div>
                            {(r.entityType || r.entityId) && (
                                <div className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">
                                    {r.entityType?.split('\\').pop()}
                                    {r.entityId !== null && <> #{r.entityId}</>}
                                    {r.ip && <span className="text-slate-600 ml-2">{r.ip}</span>}
                                </div>
                            )}
                        </button>
                        {openId === r.id && r.payload && (
                            <pre className="text-[10px] text-slate-300 font-mono bg-slate-950/50 px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all border-t border-white/10">
                                {JSON.stringify(r.payload, null, 2)}
                            </pre>
                        )}
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap font-mono ${active ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}
        >
            {children}
        </button>
    );
}

function actionColor(action: string): string {
    if (action.startsWith('view-as-admin')) return 'bg-amber-500/15 text-amber-300';
    if (action.startsWith('team')) return 'bg-violet-500/20 text-violet-300';
    if (action.startsWith('debug')) return 'bg-blue-500/20 text-blue-300';
    return 'bg-slate-700/40 text-slate-300';
}

function relativeTime(iso: string): string {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleString();
}
