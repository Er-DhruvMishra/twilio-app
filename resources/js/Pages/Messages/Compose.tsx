import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

interface Suggestion { id: number; name: string; phone: string }

export default function Compose() {
    // Pre-fill `to` from the ?to= query string so the Call/Message quick
    // actions on Phone history / Voicemail / Contacts can deep-link into a
    // ready-to-send compose.
    const initialTo = typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('to') ?? '')
        : '';
    const [to, setTo] = useState(initialTo);
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSugg, setShowSugg] = useState(false);
    const lastQueryRef = useRef('');

    // Pull contact suggestions from /api/contacts/suggest while typing.
    useEffect(() => {
        const q = to.trim();
        if (q.length < 2) { setSuggestions([]); return; }
        lastQueryRef.current = q;
        const timer = setTimeout(async () => {
            try {
                const r = await axios.get('/api/contacts/suggest', { params: { q } });
                if (lastQueryRef.current === q) setSuggestions(r.data.suggestions);
            } catch { /* ignore */ }
        }, 150);
        return () => clearTimeout(timer);
    }, [to]);

    const pick = (s: Suggestion) => {
        setTo(s.phone);
        setSuggestions([]);
        setShowSugg(false);
    };

    const send = async () => {
        const trimmed = to.trim();
        if (!trimmed) return;
        const e164 = trimmed.startsWith('+')
            ? trimmed.replace(/[^+0-9]/g, '')
            : '+' + trimmed.replace(/[^0-9]/g, '');
        setSending(true); setError(null);
        try {
            const r = await axios.post('/api/messages', { to: e164, body: body.trim() });
            router.visit(route('messages.thread', r.data.message.threadKey));
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Send failed');
        } finally {
            setSending(false);
        }
    };

    return (
        <AppFrame title="New Message" back={route('messages.threads')}>
            <Head title="New Message" />

            <div className="space-y-3">
                <label className="block relative">
                    <div className="text-xs text-slate-300 mb-1.5">To</div>
                    <input
                        value={to}
                        onChange={(e) => { setTo(e.target.value); setShowSugg(true); }}
                        onFocus={() => setShowSugg(true)}
                        placeholder="Number, name, or T9 (e.g. 2742 = ASHA)"
                        autoFocus
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 font-mono text-sm"
                    />
                    {showSugg && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 z-10 rounded-xl bg-slate-800 border border-white/10 shadow-2xl max-h-48 overflow-y-auto no-scrollbar">
                            {suggestions.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => pick(s)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left active:bg-white/10"
                                >
                                    <span className="text-white text-sm truncate flex-1">{s.name}</span>
                                    <span className="text-[11px] text-slate-400 font-mono shrink-0">{s.phone}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </label>
                <label className="block">
                    <div className="text-xs text-slate-300 mb-1.5">Message</div>
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={5}
                        placeholder="Type your message…"
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    <div className="text-xs text-slate-500 mt-1">{body.length}/1600</div>
                </label>
                {error && <div className="text-rose-400 text-sm">{error}</div>}
                <button
                    type="button"
                    onClick={send}
                    disabled={sending || !to || !body.trim()}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {sending ? 'Sending…' : 'Send'}
                </button>
            </div>
        </AppFrame>
    );
}
