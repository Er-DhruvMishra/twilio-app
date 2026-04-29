import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePrivateChannel } from '@/Hooks/useEcho';

export type Channel = 'chat' | 'rcs' | 'whatsapp' | 'facebook';

interface ConversationRow {
    id: number;
    twilioSid: string;
    channel: Channel;
    friendlyName: string | null;
    state: 'active' | 'inactive' | 'closed';
    lastMessageAt: string | null;
    unread: number;
    owner: { id: number; name: string } | null;
    participants: Array<{ id: number; identity: string | null; address: string | null; role: string }> | null;
}

interface Props {
    channel: Channel;
    title: string;
    /** Route name for the threads list (e.g. 'chat.threads'). */
    threadsRoute: string;
    /** Route name for thread view (e.g. 'chat.thread'). */
    threadRoute: string;
    /** Route name for new-conversation page (e.g. 'chat.new'). */
    newRoute: string;
    /** Optional banner shown above the list (e.g. WhatsApp 24h rule). */
    banner?: React.ReactNode;
}

export default function ChannelThreadsView({ channel, title, threadsRoute, threadRoute, newRoute, banner }: Props) {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = (auth.user?.roles ?? []).includes('admin');

    const [conversations, setConversations] = useState<ConversationRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        axios.get('/api/conversations', { params: { channel } }).then((r) => setConversations(r.data.conversations)).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [channel]);

    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.ConversationMessageReceived': (e) => {
            // Only refresh when the event is for this channel (or unknown).
            const evt = e as { channel?: string } | undefined;
            if (!evt?.channel || evt.channel === channel) load();
        },
    });

    return (
        <AppFrame
            title={title}
            back={route('home')}
            actions={<Link href={route(newRoute)} className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60">New</Link>}
        >
            <Head title={title} />
            {banner}

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && conversations.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">
                    No conversations yet. <Link href={route(newRoute)} className="text-sky-400">Start one →</Link>
                </div>
            )}

            <div className="space-y-1">
                {conversations.map((c) => (
                    <Link
                        key={c.id}
                        href={route(threadRoute, c.id)}
                        className={`block rounded-xl px-3 py-2.5 active:bg-white/10 ${c.unread > 0 ? 'bg-blue-500/10' : ''}`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="text-sm text-white truncate flex-1">
                                {c.friendlyName || (c.participants ?? []).map((p) => p.identity ?? p.address).join(', ') || `#${c.id}`}
                            </div>
                            <div className="text-[10px] text-slate-500 shrink-0">{c.lastMessageAt ? relativeTime(c.lastMessageAt) : ''}</div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                            {c.state !== 'active' && <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400">{c.state}</span>}
                            {c.unread > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center">
                                    {c.unread > 99 ? '99+' : c.unread}
                                </span>
                            )}
                            {isAdmin && c.owner && (
                                <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{c.owner.name}</span>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </AppFrame>
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
