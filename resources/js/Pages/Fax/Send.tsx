import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

interface Suggestion { id: number; name: string; phone: string }

export default function FaxSend() {
    const [to, setTo] = useState('');
    const [file, setFile] = useState<File | null>(null);
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
        if (!file || !to.trim()) return;
        const trimmed = to.trim();
        const e164 = trimmed.startsWith('+') ? trimmed.replace(/[^+0-9]/g, '') : '+' + trimmed.replace(/[^0-9]/g, '');

        setBusy(true); setError(null); setSuccess(null);
        try {
            const fd = new FormData();
            fd.append('to', e164);
            fd.append('file', file);
            const r = await axios.post('/api/faxes', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setSuccess(`Fax queued (${r.data.fax.numPages || '?'} pages).`);
            setTimeout(() => router.visit(route('fax.show', r.data.fax.id)), 700);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            const msg = err.response?.data?.errors
                ? Object.values(err.response.data.errors).flat().join(' ')
                : err.response?.data?.message;
            setError(msg ?? 'Failed to send fax');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppFrame title="Send fax" back={route('fax.index')}>
            <Head title="Send fax" />

            <div className="space-y-4">
                <Section title="Recipient">
                    <div className="relative">
                        <input
                            value={to}
                            onChange={(e) => { setTo(e.target.value); setShowSugg(true); }}
                            onFocus={() => setShowSugg(true)}
                            placeholder="Number or contact"
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

                <Section title="Document (PDF, max 30MB)">
                    <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500/20 file:text-blue-300 file:text-xs file:font-semibold"
                    />
                    {file && (
                        <div className="text-xs text-slate-400 mt-2">
                            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                    )}
                </Section>

                <div className="rounded-2xl bg-amber-500/5 border border-amber-400/20 p-3 text-amber-200 text-xs leading-relaxed">
                    Sent via fax.plus. Cost is roughly 7¢ per page; final charge depends on destination country.
                </div>

                {error && <div className="text-rose-400 text-sm">{error}</div>}
                {success && <div className="text-emerald-400 text-sm">{success}</div>}

                <button
                    type="button"
                    onClick={send}
                    disabled={busy || !to.trim() || !file}
                    className="w-full bg-rose-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-rose-600"
                >
                    {busy ? 'Sending…' : 'Send fax'}
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
