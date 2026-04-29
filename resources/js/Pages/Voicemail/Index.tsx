import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePrivateChannel } from '@/Hooks/useEcho';
import RowActions from '@/Components/RowActions';

interface Voicemail {
    id: number;
    from: string | null;
    contact: { id: number; name: string } | null;
    owner: { id: number; name: string } | null;
    duration: number | null;
    transcript: string | null;
    isRead: boolean;
    recordingId: number | null;
    recordingStatus: string | null;
    receivedAt: string;
}

export default function VoicemailIndex() {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = (auth.user?.roles ?? []).includes('admin');
    const [vms, setVms] = useState<Voicemail[]>([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<number | null>(null);

    const load = async () => {
        try {
            const r = await axios.get('/api/voicemails');
            setVms(r.data.voicemails);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.VoicemailReceived': () => load(),
        '.CallStatusUpdated': () => load(),
    });

    const open = async (vm: Voicemail) => {
        setOpenId((prev) => (prev === vm.id ? null : vm.id));
        if (!vm.isRead) {
            try {
                await axios.post(`/api/voicemails/${vm.id}/read`);
                setVms((prev) => prev.map((v) => v.id === vm.id ? { ...v, isRead: true } : v));
            } catch { /* ignore */ }
        }
    };

    const remove = async (id: number) => {
        if (!confirm('Delete this voicemail?')) return;
        await axios.delete(`/api/voicemails/${id}`);
        setVms((prev) => prev.filter((v) => v.id !== id));
        if (openId === id) setOpenId(null);
    };

    return (
        <AppFrame
            title="Voicemail"
            back={route('home')}
            actions={
                <Link
                    href={route('voicemail.send')}
                    className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60"
                >
                    Send
                </Link>
            }
        >
            <Head title="Voicemail" />

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && vms.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">
                    No voicemails. <Link href={route('voicemail.send')} className="text-sky-400">Send one →</Link>
                </div>
            )}

            <div className="space-y-1.5">
                {vms.map((vm) => (
                    <div key={vm.id} className={`rounded-2xl border p-3 ${vm.isRead ? 'bg-white/5 border-white/10' : 'bg-blue-500/10 border-blue-400/30'}`}>
                        <button
                            type="button"
                            onClick={() => open(vm)}
                            className="w-full text-left flex items-start gap-3"
                        >
                            <span className={`mt-1.5 w-2 h-2 rounded-full ${vm.isRead ? 'bg-slate-500' : 'bg-blue-400'}`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <div className={`text-sm truncate ${vm.isRead ? 'text-slate-200' : 'text-white font-semibold'}`}>
                                        {vm.contact?.name ?? vm.from ?? 'Unknown'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 shrink-0">
                                        {relativeTime(vm.receivedAt)}
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span>{formatDuration(vm.duration)}</span>
                                    {vm.from && vm.contact?.name && <span className="font-mono">· {vm.from}</span>}
                                    {isAdmin && vm.owner && (
                                        <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                                            {vm.owner.name}
                                        </span>
                                    )}
                                </div>
                                {vm.transcript && (
                                    <div className="text-xs text-slate-300 mt-1.5 leading-snug line-clamp-2">
                                        “{vm.transcript}”
                                    </div>
                                )}
                            </div>
                        </button>

                        <div className="mt-2 flex justify-end">
                            <RowActions
                                phone={vm.from}
                                hasContact={!!vm.contact}
                                suggestedName={vm.contact?.name ?? vm.from}
                                onSaved={load}
                            />
                        </div>

                        {openId === vm.id && (
                            <div className="mt-3 space-y-2">
                                {vm.recordingId && vm.recordingStatus === 'completed' ? (
                                    <audio
                                        controls
                                        src={`/api/recordings/${vm.recordingId}/audio`}
                                        className="w-full h-10"
                                    />
                                ) : (
                                    <div className="text-xs text-slate-400 italic">
                                        {vm.recordingStatus === 'processing' ? 'Recording is still processing…' : 'No recording attached.'}
                                    </div>
                                )}
                                {vm.transcript && (
                                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-200 leading-relaxed">
                                        {vm.transcript}
                                    </div>
                                )}
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => remove(vm.id)}
                                        className="text-rose-300 text-xs px-2 py-1 active:opacity-70"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}

function formatDuration(s: number | null): string {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, '0')}`;
}

function relativeTime(iso: string): string {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
}
