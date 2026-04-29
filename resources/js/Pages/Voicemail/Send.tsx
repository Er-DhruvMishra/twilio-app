import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

interface Suggestion { id: number; name: string; phone: string }

const VOICES = [
    { value: '', label: 'Default (Twilio)' },
    { value: 'alice', label: 'Alice (en-US)' },
    { value: 'Polly.Joanna', label: 'Polly Joanna (en-US, female)' },
    { value: 'Polly.Matthew', label: 'Polly Matthew (en-US, male)' },
    { value: 'Polly.Aditi', label: 'Polly Aditi (en-IN, female)' },
    { value: 'Polly.Raveena', label: 'Polly Raveena (en-IN, female)' },
    { value: 'Polly.Brian', label: 'Polly Brian (en-GB, male)' },
];

export default function VoicemailSend() {
    const [mode, setMode] = useState<'tts' | 'audio_url'>('tts');
    const [to, setTo] = useState('');
    const [message, setMessage] = useState('');
    const [audioUrl, setAudioUrl] = useState('');
    const [voice, setVoice] = useState('Polly.Joanna');
    const [language, setLanguage] = useState('en-US');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSugg, setShowSugg] = useState(false);
    const lastQ = useRef('');

    useEffect(() => {
        const q = to.trim();
        if (q.length < 2) { setSuggestions([]); return; }
        lastQ.current = q;
        const t = setTimeout(async () => {
            try {
                const r = await axios.get('/api/contacts/suggest', { params: { q } });
                if (lastQ.current === q) setSuggestions(r.data.suggestions);
            } catch { /* noop */ }
        }, 150);
        return () => clearTimeout(t);
    }, [to]);

    const send = async () => {
        const trimmed = to.trim();
        if (!trimmed) return;
        const e164 = trimmed.startsWith('+')
            ? trimmed.replace(/[^+0-9]/g, '')
            : '+' + trimmed.replace(/[^0-9]/g, '');

        setBusy(true); setError(null); setSuccess(null);
        try {
            const r = await axios.post('/api/voicemails/send', {
                to: e164,
                mode,
                message: mode === 'tts' ? message : null,
                audio_url: mode === 'audio_url' ? audioUrl : null,
                voice: mode === 'tts' && voice ? voice : null,
                language: mode === 'tts' && language ? language : null,
            });
            setSuccess(r.data.message);
            setTimeout(() => router.visit(route('voicemail.index')), 800);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            const msg = err.response?.data?.errors
                ? Object.values(err.response.data.errors).flat().join(' ')
                : err.response?.data?.message;
            setError(msg ?? 'Failed to send voicemail.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppFrame title="Send voicemail" back={route('voicemail.index')}>
            <Head title="Send voicemail" />

            <div className="space-y-4">
                <Section title="Recipient">
                    <div className="relative">
                        <input
                            value={to}
                            onChange={(e) => { setTo(e.target.value); setShowSugg(true); }}
                            onFocus={() => setShowSugg(true)}
                            placeholder="Number, name, or T9"
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 font-mono text-sm"
                        />
                        {showSugg && suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 z-10 rounded-xl bg-slate-800 border border-white/10 shadow-2xl max-h-48 overflow-y-auto no-scrollbar">
                                {suggestions.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => { setTo(s.phone); setShowSugg(false); setSuggestions([]); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-left active:bg-white/10"
                                    >
                                        <span className="text-white text-sm truncate flex-1">{s.name}</span>
                                        <span className="text-[11px] text-slate-400 font-mono shrink-0">{s.phone}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </Section>

                <Section title="Message">
                    <div className="flex gap-1 mb-3">
                        <ModeBtn label="Text-to-speech" active={mode === 'tts'} onClick={() => setMode('tts')} />
                        <ModeBtn label="Audio URL" active={mode === 'audio_url'} onClick={() => setMode('audio_url')} />
                    </div>

                    {mode === 'tts' ? (
                        <>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={5}
                                placeholder="Hi, this is Asha calling from… please call me back at…"
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                                maxLength={1500}
                            />
                            <div className="text-[10px] text-slate-500 mt-1 text-right">{message.length}/1500</div>

                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <label className="block">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Voice</div>
                                    <select
                                        aria-label="Voice"
                                        value={voice}
                                        onChange={(e) => setVoice(e.target.value)}
                                        className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-400"
                                    >
                                        {VOICES.map((v) => (
                                            <option key={v.value} value={v.value} className="bg-slate-800">{v.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Language</div>
                                    <input
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        placeholder="en-US"
                                        className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-400 font-mono"
                                    />
                                </label>
                            </div>
                        </>
                    ) : (
                        <>
                            <input
                                value={audioUrl}
                                onChange={(e) => setAudioUrl(e.target.value)}
                                placeholder="https://example.com/voicemail.mp3"
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm font-mono"
                            />
                            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                                Paste a publicly-reachable URL to an mp3 or wav file. Twilio will fetch and play it. The host must support HTTPS.
                            </p>
                        </>
                    )}
                </Section>

                <div className="rounded-2xl bg-blue-500/5 border border-blue-400/20 p-3 text-blue-200 text-xs leading-relaxed">
                    Twilio will dial the recipient and play your message. If voicemail picks up, it'll capture the message; if a person answers, they'll hear it too. You can monitor delivery in <span className="font-mono">/phone/history</span>.
                </div>

                {error && <div className="text-rose-400 text-sm">{error}</div>}
                {success && <div className="text-emerald-400 text-sm">{success}</div>}

                <button
                    type="button"
                    onClick={send}
                    disabled={busy || !to || (mode === 'tts' ? !message.trim() : !audioUrl.trim())}
                    className="w-full bg-rose-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-rose-600"
                >
                    {busy ? 'Sending…' : 'Send voicemail'}
                </button>
            </div>
        </AppFrame>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
    </section>
);

const ModeBtn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex-1 text-xs px-3 py-1.5 rounded-full font-medium ${active ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}
    >
        {label}
    </button>
);
