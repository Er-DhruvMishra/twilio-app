import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePrivateChannel } from '@/Hooks/useEcho';
import RowActions from '@/Components/RowActions';

interface Thread {
    threadKey: string;
    peer: string;
    contact: { id: number; name: string } | null;
    owner: { id: number; name: string } | null;
    lastMessage: {
        body: string;
        numMedia: number;
        direction: 'inbound' | 'outbound';
        status: string;
        sentAt: string;
    };
    unread: number;
}

export default function Threads() {
    const { auth, twilio } = usePage<PageProps>().props;
    const isAdmin = (auth.user?.roles ?? []).includes('admin');
    const [threads, setThreads] = useState<Thread[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const r = await axios.get('/api/messages/threads');
            setThreads(r.data.threads);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.MessageReceived': () => load(),
        '.MessageStatusUpdated': () => load(),
    });

    return (
        <AppFrame
            title="Messages"
            back={route('home')}
            actions={
                <Link
                    href={route('messages.compose')}
                    className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60"
                >
                    New
                </Link>
            }
        >
            <Head title="Messages" />

            {!twilio?.configured && (
                <div className="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3 text-amber-200 text-sm mb-3">
                    Connect a Twilio number to send and receive SMS.
                </div>
            )}

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && threads.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">No conversations yet.</div>
            )}

            <div className="space-y-1">
                {threads.map((t) => (
                    <div key={`${t.owner?.id ?? 'me'}-${t.threadKey}`} className="rounded-xl px-3 py-2.5 active:bg-white/10 flex items-start gap-3">
                        <Link
                            href={isAdmin && t.owner ? `${route('messages.thread', t.threadKey)}?owner=${t.owner.id}` : route('messages.thread', t.threadKey)}
                            className="flex items-start gap-3 flex-1 min-w-0"
                        >
                            <Avatar name={t.contact?.name ?? t.peer} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <div className={`text-sm font-medium truncate ${t.unread > 0 ? 'text-white' : 'text-slate-200'}`}>
                                        {t.contact?.name ?? t.peer}
                                    </div>
                                    <div className="text-[10px] text-slate-500 shrink-0">{relativeTime(t.lastMessage.sentAt)}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`text-xs truncate flex-1 ${t.unread > 0 ? 'text-slate-200' : 'text-slate-400'}`}>
                                        {t.lastMessage.direction === 'outbound' && <span className="text-slate-500">You: </span>}
                                        {previewBody(t.lastMessage.body, t.lastMessage.numMedia)}
                                    </div>
                                    {isAdmin && t.owner && (
                                        <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 shrink-0">
                                            {t.owner.name}
                                        </span>
                                    )}
                                    {t.unread > 0 && (
                                        <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center">
                                            {t.unread > 99 ? '99+' : t.unread}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                        <RowActions
                            phone={t.peer}
                            hasContact={!!t.contact}
                            suggestedName={t.contact?.name ?? t.peer}
                            onSaved={load}
                        />
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}

const Avatar = ({ name }: { name: string }) => {
    const initials = name.replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '#';
    return (
        <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-slate-200 text-sm font-semibold">
            {initials}
        </div>
    );
};

function previewBody(body: string, numMedia: number): string {
    const trimmed = (body ?? '').trim();
    if (trimmed) return trimmed;
    if (numMedia > 0) return `📎 ${numMedia} attachment${numMedia > 1 ? 's' : ''}`;
    return '';
}

function relativeTime(iso: string): string {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
