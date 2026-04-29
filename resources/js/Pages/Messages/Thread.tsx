import AppFrame from '@/Layouts/AppFrame';
import { Head, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { usePrivateChannel } from '@/Hooks/useEcho';

interface Msg {
    id: number;
    direction: 'inbound' | 'outbound';
    body: string;
    numMedia: number;
    media: Array<{ url: string; contentType: string }>;
    status: string;
    errorCode: string | null;
    errorMessage: string | null;
    sentAt: string;
    deliveredAt: string | null;
}

interface ThreadResponse {
    threadKey: string;
    peer: string | null;
    contact: { id: number; name: string } | null;
    messages: Msg[];
}

interface Props { threadKey: string }

export default function Thread({ threadKey }: Props) {
    const { auth } = usePage<PageProps>().props;
    const [data, setData] = useState<ThreadResponse | null>(null);
    const [composing, setComposing] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const load = async () => {
        try {
            const r = await axios.get(`/api/messages/${encodeURIComponent(threadKey)}`);
            setData(r.data);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Failed to load thread');
        }
    };

    useEffect(() => { load(); }, [threadKey]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [data?.messages.length]);

    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.MessageReceived': (payload: unknown) => {
            const p = payload as { threadKey: string };
            if (p.threadKey === threadKey) load();
        },
        '.MessageStatusUpdated': (payload: unknown) => {
            const p = payload as { threadKey: string };
            if (p.threadKey === threadKey) load();
        },
    });

    const send = async () => {
        if (!composing.trim() || !data?.peer) return;
        setSending(true); setError(null);
        try {
            await axios.post('/api/messages', { to: data.peer, body: composing.trim() });
            setComposing('');
            load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Send failed');
        } finally {
            setSending(false);
        }
    };

    const peerLabel = data?.contact?.name ?? data?.peer ?? 'Conversation';

    return (
        <AppFrame title={peerLabel} back={route('messages.threads')}>
            <Head title={peerLabel} />

            {data?.peer && data.peer !== peerLabel && (
                <div className="text-center text-xs text-slate-400 font-mono pb-2">{data.peer}</div>
            )}

            <div ref={scrollRef} className="overflow-y-auto pb-20 max-h-[560px]">
                {!data && <div className="text-center text-slate-400 text-sm py-6">Loading…</div>}
                {data?.messages.map((m) => (
                    <Bubble key={m.id} m={m} />
                ))}
                {data && data.messages.length === 0 && (
                    <div className="text-slate-400 text-sm text-center py-10">No messages yet.</div>
                )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-slate-900/95 border-t border-white/10 backdrop-blur">
                {error && <div className="text-rose-400 text-xs mb-1">{error}</div>}
                <div className="flex items-center gap-2">
                    <textarea
                        value={composing}
                        onChange={(e) => setComposing(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                        rows={1}
                        placeholder="Message"
                        className="flex-1 resize-none rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    <button
                        type="button"
                        onClick={send}
                        disabled={sending || !composing.trim()}
                        aria-label="Send"
                        className="w-9 h-9 rounded-full bg-blue-500 active:bg-blue-600 disabled:opacity-40 flex items-center justify-center"
                    >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
                            <path d="M2 12L22 2L13 22L11 13L2 12Z" />
                        </svg>
                    </button>
                </div>
            </div>
        </AppFrame>
    );
}

function Bubble({ m }: { m: Msg }) {
    const mine = m.direction === 'outbound';
    const failed = ['failed', 'undelivered'].includes(m.status);
    return (
        <div className={`px-2 py-0.5 flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? (failed ? 'bg-rose-700' : 'bg-blue-600') : 'bg-white/10'}`}>
                {m.media.length > 0 && (
                    <div className="space-y-1.5 mb-1.5">
                        {m.media.map((media, i) => (
                            media.contentType.startsWith('image/') ? (
                                <img key={i} src={media.url} alt="" className="rounded-lg max-w-full" />
                            ) : (
                                <a key={i} href={media.url} target="_blank" rel="noreferrer" className="block text-xs underline">
                                    📎 {media.contentType}
                                </a>
                            )
                        ))}
                    </div>
                )}
                {m.body && <div className="text-white text-sm whitespace-pre-wrap break-words">{m.body}</div>}
                <div className="text-[10px] text-white/60 mt-0.5 flex items-center gap-1.5 justify-end">
                    {failed && <span className="text-rose-200">failed</span>}
                    <span>{new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {mine && !failed && <StatusTick status={m.status} />}
                </div>
            </div>
        </div>
    );
}

function StatusTick({ status }: { status: string }) {
    if (status === 'delivered' || status === 'read') {
        return <span title={status}>✓✓</span>;
    }
    if (status === 'sent') return <span title={status}>✓</span>;
    if (status === 'queued' || status === 'sending') return <span title={status}>⋯</span>;
    return null;
}
