import AppFrame from '@/Layouts/AppFrame';
import { Head, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePrivateChannel } from '@/Hooks/useEcho';
import RowActions from '@/Components/RowActions';

interface CallItem {
    id: number;
    direction: 'inbound' | 'outbound';
    from: string;
    to: string;
    status: string;
    disposition: string | null;
    duration: number | null;
    startedAt: string;
    isVoicemail: boolean;
    tag: string | null;
    contact: { id: number; name: string } | null;
    owner: { id: number; name: string } | null;
    recording: { id: number; duration: number | null; status: string } | null;
}

type Filter = 'all' | 'incoming' | 'outgoing' | 'missed' | 'voicemail';

export default function History() {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = (auth.user?.roles ?? []).includes('admin');
    const [filter, setFilter] = useState<Filter>('all');
    const [calls, setCalls] = useState<CallItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/calls', { params: { filter } });
            setCalls(r.data.calls);
        } finally {
            setLoading(false);
        }
    };

    const sync = async () => {
        setSyncing(true); setSyncResult(null);
        try {
            const r = await axios.post('/api/calls/sync');
            setSyncResult(r.data.message);
            await load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setSyncResult(err.response?.data?.message ?? 'Sync failed');
        } finally {
            setSyncing(false);
            setTimeout(() => setSyncResult(null), 3000);
        }
    };

    useEffect(() => { load(); }, [filter]);

    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.IncomingCallReceived': () => load(),
        '.CallStatusUpdated': () => load(),
    });

    return (
        <AppFrame
            title="Call History"
            back={route('home')}
            actions={
                <button
                    type="button"
                    onClick={sync}
                    disabled={syncing}
                    className="text-sky-400 text-xs font-semibold px-2 py-1 active:opacity-60 disabled:opacity-50"
                    title="Pull recent calls from Twilio"
                >
                    {syncing ? '⟳' : 'Sync'}
                </button>
            }
        >
            <Head title="Call History" />

            {syncResult && (
                <div className="mb-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-2.5 text-emerald-300 text-xs">
                    {syncResult}
                </div>
            )}

            <div className="flex gap-1 mb-3 overflow-x-auto -mx-1 px-1 no-scrollbar">
                {(['all','incoming','outgoing','missed','voicemail'] as Filter[]).map((f) => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${filter === f ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && calls.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">No calls yet.</div>
            )}

            <div className="space-y-1.5">
                {calls.map((c) => (
                    <CallRow key={c.id} call={c} showOwner={isAdmin} onSaved={load} />
                ))}
            </div>
        </AppFrame>
    );
}

function CallRow({ call, showOwner, onSaved }: { call: CallItem; showOwner: boolean; onSaved: () => void }) {
    const [showRecording, setShowRecording] = useState(false);

    const peer = call.direction === 'inbound' ? call.from : call.to;
    const name = call.contact?.name ?? peer;
    const tone =
        call.disposition === 'missed' || call.disposition === 'rejected' ? 'text-rose-400'
        : call.disposition === 'blocked' ? 'text-rose-500'
        : call.direction === 'inbound' ? 'text-emerald-300'
        : 'text-white';

    return (
        <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <div className="flex items-center gap-3">
                <DirectionIcon direction={call.direction} disposition={call.disposition} />
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${tone}`}>{name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                        <span className="capitalize">{call.disposition ?? call.status}</span>
                        <span>·</span>
                        <span>{relativeTime(call.startedAt)}</span>
                        {call.duration ? <><span>·</span><span>{formatDuration(call.duration)}</span></> : null}
                        {showOwner && call.owner && (
                            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                                {call.owner.name}
                            </span>
                        )}
                    </div>
                </div>
                <RowActions
                    phone={peer}
                    hasContact={!!call.contact}
                    suggestedName={call.contact?.name ?? peer}
                    onSaved={onSaved}
                />
                {call.recording && call.recording.status === 'completed' && (
                    <button
                        type="button"
                        onClick={() => setShowRecording((s) => !s)}
                        className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 active:bg-blue-500/30"
                    >
                        {showRecording ? 'Hide' : 'Play'}
                    </button>
                )}
            </div>
            {showRecording && call.recording && (
                <audio
                    controls
                    src={`/api/recordings/${call.recording.id}/audio`}
                    className="mt-2 w-full h-8"
                />
            )}
        </div>
    );
}

function DirectionIcon({ direction, disposition }: { direction: string; disposition: string | null }) {
    const isMissed = disposition === 'missed' || disposition === 'rejected' || disposition === 'blocked';
    const color = isMissed ? 'text-rose-400' : direction === 'inbound' ? 'text-emerald-400' : 'text-white';
    const path = direction === 'inbound'
        ? 'M19 12H5 M12 5l-7 7 7 7'
        : 'M5 12h14 M12 19l7-7-7-7';
    return (
        <svg viewBox="0 0 24 24" className={`w-5 h-5 shrink-0 ${color}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={path} />
        </svg>
    );
}

function formatDuration(s: number | null): string {
    if (!s) return '0:00';
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, '0')}`;
}

function relativeTime(iso: string): string {
    const date = new Date(iso);
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
}
