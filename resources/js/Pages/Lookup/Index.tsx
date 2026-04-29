import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePrivateChannel } from '@/Hooks/useEcho';

interface LookupRow {
    id: number;
    phone: string;
    callerName: string | null;
    callerType: 'business' | 'consumer' | null;
    lineType: string | null;
    carrierName: string | null;
    countryCode: string | null;
    isValid: boolean;
    source: string;
    costCents: number;
    lookedUpAt: string;
    requester: { id: number; name: string } | null;
}

type Source = '' | 'manual_search' | 'incoming_manual' | 'incoming_auto' | 'outgoing_manual' | 'outgoing_auto';

export default function LookupIndex() {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = (auth.user?.roles ?? []).includes('admin');

    const [phone, setPhone] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [latest, setLatest] = useState<LookupRow | null>(null);

    const [history, setHistory] = useState<LookupRow[]>([]);
    const [sourceFilter, setSourceFilter] = useState<Source>('');
    const [phoneFilter, setPhoneFilter] = useState('');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/lookups', {
                params: {
                    source: sourceFilter || undefined,
                    phone: phoneFilter || undefined,
                },
            });
            setHistory(r.data.lookups);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [sourceFilter, phoneFilter]);

    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.LookupCompleted': () => load(),
    });

    const identify = async () => {
        const trimmed = phone.trim();
        if (!trimmed) return;
        const e164 = trimmed.startsWith('+')
            ? trimmed.replace(/[^+0-9]/g, '')
            : '+' + trimmed.replace(/[^0-9]/g, '');

        setBusy(true); setError(null); setLatest(null);
        try {
            const r = await axios.post('/api/lookups', { phone: e164, source: 'manual_search' });
            setLatest(r.data.lookup);
            await load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Lookup failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppFrame title="Lookup" back={route('home')}>
            <Head title="Lookup" />

            <Section title="Identify a number">
                <div className="flex gap-2 mb-2">
                    <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && identify()}
                        placeholder="+1 415 555 0123"
                        className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm font-mono"
                    />
                    <button
                        type="button"
                        onClick={identify}
                        disabled={busy || !phone.trim()}
                        className="bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {busy ? '⟳' : 'Identify'}
                    </button>
                </div>
                <div className="text-[10px] text-slate-500">
                    Caller name (CNAM) is US/CA only and costs ~$0.01/lookup. Line type intelligence covers most countries.
                </div>
                {error && <div className="text-rose-400 text-xs mt-2">{error}</div>}
                {latest && <ResultCard row={latest} />}
            </Section>

            <Section title="History">
                <div className="flex gap-2 mb-2 flex-wrap">
                    <select
                        aria-label="Source"
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value as Source)}
                        className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-400"
                    >
                        <option value="" className="bg-slate-800">All sources</option>
                        <option value="manual_search" className="bg-slate-800">Manual search</option>
                        <option value="incoming_manual" className="bg-slate-800">Incoming · manual</option>
                        <option value="incoming_auto" className="bg-slate-800">Incoming · auto</option>
                        <option value="outgoing_manual" className="bg-slate-800">Outgoing · manual</option>
                        <option value="outgoing_auto" className="bg-slate-800">Outgoing · auto</option>
                    </select>
                    <input
                        value={phoneFilter}
                        onChange={(e) => setPhoneFilter(e.target.value)}
                        placeholder="Filter by number"
                        className="flex-1 min-w-[140px] rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-400 font-mono"
                    />
                </div>

                {loading && <div className="text-slate-400 text-xs text-center py-3">Loading…</div>}
                {!loading && history.length === 0 && (
                    <div className="text-slate-400 text-xs text-center py-6">No lookups yet.</div>
                )}

                <div className="divide-y divide-white/10">
                    {history.map((r) => (
                        <Link
                            key={r.id}
                            href={route('lookup.show', r.id)}
                            className="block py-2 active:opacity-70"
                        >
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white truncate">
                                        {r.callerName ?? <span className="text-slate-400 italic">No name</span>}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono truncate">{r.phone}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <SourceChip source={r.source} />
                                        {r.lineType && <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-300">{r.lineType}</span>}
                                        {r.carrierName && <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{r.carrierName}</span>}
                                        {isAdmin && r.requester && (
                                            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{r.requester.name}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-500 shrink-0 text-right">
                                    {relativeTime(r.lookedUpAt)}
                                    {r.costCents > 0 && <div className="text-emerald-300">${(r.costCents / 100).toFixed(2)}</div>}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </Section>
        </AppFrame>
    );
}

function ResultCard({ row }: { row: LookupRow }) {
    return (
        <div className={`mt-3 rounded-2xl p-3 ${row.isValid ? 'bg-emerald-500/5 border border-emerald-400/30' : 'bg-rose-500/5 border border-rose-400/30'}`}>
            <div className="text-sm text-white font-semibold">
                {row.callerName ?? (row.isValid ? 'No caller name available' : 'Invalid number')}
            </div>
            <div className="text-xs text-slate-300 font-mono mt-0.5">{row.phone}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                {row.callerType && <KV k="Type" v={row.callerType} />}
                {row.lineType && <KV k="Line" v={row.lineType} />}
                {row.carrierName && <KV k="Carrier" v={row.carrierName} />}
                {row.countryCode && <KV k="Country" v={row.countryCode} />}
            </div>
        </div>
    );
}

function KV({ k, v }: { k: string; v: string }) {
    return (
        <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500">{k}</div>
            <div className="text-slate-200 truncate">{v}</div>
        </div>
    );
}

function SourceChip({ source }: { source: string }) {
    const map: Record<string, { label: string; color: string }> = {
        manual_search: { label: 'Search', color: 'bg-blue-500/20 text-blue-300' },
        incoming_manual: { label: 'In · manual', color: 'bg-emerald-500/20 text-emerald-300' },
        incoming_auto: { label: 'In · auto', color: 'bg-emerald-500/10 text-emerald-400' },
        outgoing_manual: { label: 'Out · manual', color: 'bg-violet-500/20 text-violet-300' },
        outgoing_auto: { label: 'Out · auto', color: 'bg-violet-500/10 text-violet-400' },
    };
    const meta = map[source] ?? { label: source, color: 'bg-slate-700/40 text-slate-300' };
    return (
        <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${meta.color}`}>
            {meta.label}
        </span>
    );
}

function relativeTime(iso: string): string {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
    </section>
);
