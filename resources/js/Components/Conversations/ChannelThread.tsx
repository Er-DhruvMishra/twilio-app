import AppFrame from '@/Layouts/AppFrame';
import { Head, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { usePrivateChannel } from '@/Hooks/useEcho';

interface Conversation {
    id: number;
    channel: string;
    friendlyName: string | null;
    state: string;
    participants: Array<{ identity: string | null; address: string | null; role: string }> | null;
}

interface Message {
    id: number;
    twilioSid: string;
    index: number;
    authorIdentity: string | null;
    authorUserId: number | null;
    body: string | null;
    numMedia: number;
    deliveryStatus: string;
    sentAt: string | null;
}

interface Props {
    conversationId: number;
    threadsRoute: string;
}

export default function ChannelThread({ conversationId, threadsRoute }: Props) {
    const { auth } = usePage<PageProps>().props;
    const myIdentity = auth.user ? `user_${auth.user.id}` : null;
    const [conv, setConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const load = async () => {
        try {
            const r = await axios.get(`/api/conversations/${conversationId}`);
            setConv(r.data.conversation);
            setMessages(r.data.messages);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [conversationId]);
    useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.ConversationMessageReceived': () => load(),
    });

    const send = async () => {
        if (!body.trim()) return;
        setBusy(true);
        try {
            await axios.post(`/api/conversations/${conversationId}/messages`, { body: body.trim() });
            setBody('');
            await load();
        } finally { setBusy(false); }
    };

    const headerName = conv?.friendlyName
        || (conv?.participants ?? []).filter((p) => p.identity !== myIdentity).map((p) => p.identity ?? p.address).join(', ')
        || `Conversation #${conversationId}`;

    return (
        <AppFrame title={headerName} back={route(threadsRoute)}>
            <Head title={headerName} />

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}

            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar -mx-2 px-2 space-y-1.5 mb-2 max-h-[55vh]">
                {messages.map((m) => {
                    const mine = m.authorIdentity === myIdentity;
                    return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-white/10 text-slate-100 rounded-bl-sm'}`}>
                                {!mine && m.authorIdentity && <div className="text-[10px] opacity-75 mb-0.5">{m.authorIdentity}</div>}
                                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                                <div className={`text-[9px] mt-1 ${mine ? 'text-blue-100' : 'text-slate-400'}`}>
                                    {m.sentAt ? new Date(m.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                                    {mine && <span className="ml-1">· {m.deliveryStatus}</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-2">
                <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder="Message"
                    className="flex-1 rounded-full bg-white/10 border border-white/10 px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                />
                <button
                    type="button"
                    onClick={send}
                    disabled={busy || !body.trim()}
                    className="bg-blue-500 text-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    Send
                </button>
            </div>
        </AppFrame>
    );
}
