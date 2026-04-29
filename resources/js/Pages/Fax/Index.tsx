import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePrivateChannel } from '@/Hooks/useEcho';

interface FaxRow {
    id: number;
    direction: 'inbound' | 'outbound';
    from: string | null;
    to: string | null;
    numPages: number;
    status: string;
    errorMessage: string | null;
    isRead: boolean;
    costCents: number;
    startedAt: string | null;
    contact: { id: number; name: string } | null;
    owner: { id: number; name: string } | null;
}

type Filter = '' | 'inbound' | 'outbound';

export default function FaxIndex() {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = (auth.user?.roles ?? []).includes('admin');
    const canSend = (auth.user?.permissions ?? []).includes('send-fax');

    const [filter, setFilter] = useState<Filter>('');
    const [faxes, setFaxes] = useState<FaxRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/faxes', { params: { direction: filter || undefined } });
            setFaxes(r.data.faxes);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [filter]);

    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.FaxReceived': () => load(),
        '.FaxStatusUpdated': () => load(),
    });

    return (
        <AppFrame
            title="Fax"
            back={route('home')}
            actions={canSend ? (
                <Link href={route('fax.send')} className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60">Send</Link>
            ) : undefined}
        >
            <Head title="Fax" />

            <div className="flex gap-1 mb-3">
                <Pill active={filter === ''} onClick={() => setFilter('')}>All</Pill>
                <Pill active={filter === 'inbound'} onClick={() => setFilter('inbound')}>Inbound</Pill>
                <Pill active={filter === 'outbound'} onClick={() => setFilter('outbound')}>Outbound</Pill>
            </div>

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && faxes.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">
                    No faxes yet.{canSend && <> <Link href={route('fax.send')} className="text-sky-400">Send one →</Link></>}
                </div>
            )}

            <div className="space-y-1.5">
                {faxes.map((f) => {
                    const peer = f.direction === 'inbound' ? f.from : f.to;
                    return (
                        <Link
                            key={f.id}
                            href={route('fax.show', f.id)}
                            className={`block rounded-xl border px-3 py-2.5 active:bg-white/10 ${!f.isRead && f.direction === 'inbound' ? 'bg-blue-500/10 border-blue-400/30' : 'bg-white/5 border-white/10'}`}
                        >
                            <div className="flex items-center gap-3">
                                <DirectionIcon direction={f.direction} status={f.status} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white truncate">{f.contact?.name ?? peer ?? 'Unknown'}</div>
                                    <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                                        <StatusChip status={f.status} />
                                        <span>{f.numPages} {f.numPages === 1 ? 'page' : 'pages'}</span>
                                        {f.startedAt && <><span>·</span><span>{relativeTime(f.startedAt)}</span></>}
                                        {f.costCents > 0 && <><span>·</span><span className="text-emerald-300">${(f.costCents / 100).toFixed(2)}</span></>}
                                        {isAdmin && f.owner && (
                                            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{f.owner.name}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </AppFrame>
    );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-xs px-3 py-1.5 rounded-full font-medium ${active ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}
        >
            {children}
        </button>
    );
}

function StatusChip({ status }: { status: string }) {
    const map: Record<string, string> = {
        success: 'bg-emerald-500/20 text-emerald-300',
        failed: 'bg-rose-500/20 text-rose-300',
        in_progress: 'bg-amber-500/20 text-amber-300',
        queued: 'bg-slate-700/40 text-slate-300',
        canceled: 'bg-slate-700/40 text-slate-400',
        partially_successful: 'bg-amber-500/15 text-amber-200',
    };
    const color = map[status] ?? 'bg-slate-700/40 text-slate-300';
    return (
        <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${color}`}>
            {status.replace('_', ' ')}
        </span>
    );
}

function DirectionIcon({ direction, status }: { direction: string; status: string }) {
    const failed = status === 'failed';
    const color = failed ? 'text-rose-400' : direction === 'inbound' ? 'text-emerald-400' : 'text-white';
    return (
        <svg viewBox="0 0 24 24" className={`w-5 h-5 shrink-0 ${color}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 9h-1V4H6v5H5a2 2 0 00-2 2v5h4v4h10v-4h4v-5a2 2 0 00-2-2zM8 6h8v3H8V6zm0 13v-4h8v4H8z" />
        </svg>
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
