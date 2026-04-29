import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Flag { module: string; enabled: boolean }

const META: Record<string, { label: string; hint: string; color: string }> = {
    voice: { label: 'Voice / Calls', hint: 'Twilio Voice SDK + AccessToken + inbound TwiML.', color: 'bg-emerald-500' },
    messaging: { label: 'SMS / MMS', hint: 'Outbound and inbound SMS via Twilio Messages.', color: 'bg-green-500' },
    lookup: { label: 'Lookup', hint: 'Twilio Lookup v2 calls + cache hits.', color: 'bg-blue-500' },
    billing: { label: 'Billing', hint: 'Twilio Balance + Usage Records snapshots.', color: 'bg-emerald-600' },
    conversations: { label: 'Conversations', hint: 'Chat / RCS / WhatsApp / Facebook (shared service).', color: 'bg-blue-400' },
    video: { label: 'Video', hint: 'Twilio Video room + recording API calls.', color: 'bg-pink-500' },
    fax: { label: 'Fax', hint: 'fax.plus REST API + signed webhooks.', color: 'bg-zinc-500' },
    mail: { label: 'Mail', hint: 'SendGrid send + event webhooks + Inbound Parse.', color: 'bg-sky-500' },
    webhooks: { label: 'Inbound webhooks', hint: 'Raw payloads + signature checks for all vendor webhooks.', color: 'bg-amber-500' },
};

export default function DebugSettings() {
    const [flags, setFlags] = useState<Flag[]>([]);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [tail, setTail] = useState<string[]>([]);
    const [tailLoading, setTailLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [sourceFile, setSourceFile] = useState<string | null>(null);

    const load = async () => {
        const r = await axios.get('/api/debug/flags');
        setFlags(r.data.flags);
    };

    const loadTail = async () => {
        setTailLoading(true);
        try {
            const r = await axios.get('/api/debug/log', { params: { lines: 200 } });
            setTail(r.data.lines ?? []);
            setSourceFile(r.data.sourceFile ?? null);
        } finally { setTailLoading(false); }
    };

    useEffect(() => { load(); loadTail(); }, []);
    useEffect(() => {
        if (!autoRefresh) return;
        const id = setInterval(loadTail, 3000);
        return () => clearInterval(id);
    }, [autoRefresh]);

    const toggle = (module: string) => {
        setFlags((prev) => prev.map((f) => f.module === module ? { ...f, enabled: !f.enabled } : f));
    };

    const enableAll = (state: boolean) => {
        setFlags((prev) => prev.map((f) => ({ ...f, enabled: state })));
    };

    const save = async () => {
        setBusy(true); setError(null); setSaved(false);
        try {
            await axios.put('/api/debug/flags', { flags });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Save failed');
        } finally { setBusy(false); }
    };

    const clearLog = async () => {
        if (!confirm('Clear the module-debug log file?')) return;
        await axios.delete('/api/debug/log');
        await loadTail();
    };

    const enabledCount = flags.filter((f) => f.enabled).length;

    return (
        <AppFrame title="Debug" back={route('settings.index')}>
            <Head title="Debug" />

            <div className="rounded-2xl bg-amber-500/5 border border-amber-400/20 p-3 text-amber-200 text-xs leading-relaxed mb-4">
                When a module is on, every API request and response (and inbound webhook payload, if you toggle <span className="font-mono">webhooks</span>) is written to{' '}
                <span className="font-mono break-all">storage/logs/{sourceFile ?? 'module-debug-YYYY-MM-DD.log'}</span>{' '}
                — rotated daily, kept 7 days. Tokens, signing keys, and JWTs are auto-redacted before being logged.
            </div>

            <Section title={`Modules · ${enabledCount} on`}>
                <div className="flex gap-2 mb-3">
                    <button type="button" onClick={() => enableAll(true)} className="text-xs text-emerald-300 px-2 py-1 active:opacity-70">All on</button>
                    <button type="button" onClick={() => enableAll(false)} className="text-xs text-rose-300 px-2 py-1 active:opacity-70">All off</button>
                </div>
                <div className="space-y-1">
                    {flags.map((f) => {
                        const meta = META[f.module] ?? { label: f.module, hint: '', color: 'bg-slate-500' };
                        return (
                            <label key={f.module} className="flex items-start gap-3 px-2 py-2 rounded-lg active:bg-white/5 cursor-pointer">
                                <span className={`mt-1.5 inline-block w-2 h-2 rounded-full ${meta.color}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white">{meta.label}</div>
                                    {meta.hint && <div className="text-[11px] text-slate-400 leading-snug">{meta.hint}</div>}
                                </div>
                                <input
                                    type="checkbox"
                                    checked={f.enabled}
                                    onChange={() => toggle(f.module)}
                                    aria-label={`Toggle ${meta.label}`}
                                    className="mt-1 rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
                                />
                            </label>
                        );
                    })}
                </div>

                {error && <div className="text-rose-400 text-sm mt-2">{error}</div>}
                {saved && <div className="text-emerald-400 text-sm mt-2">Saved.</div>}

                <button
                    type="button"
                    onClick={save}
                    disabled={busy}
                    className="w-full mt-3 bg-blue-500 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {busy ? 'Saving…' : 'Save'}
                </button>
            </Section>

            <Section title="Live tail (last 200 lines)">
                <div className="flex gap-2 mb-2">
                    <button type="button" onClick={loadTail} disabled={tailLoading} className="text-xs text-sky-300 px-2 py-1 active:opacity-70 disabled:opacity-50">
                        {tailLoading ? 'Loading…' : 'Refresh'}
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 px-2 py-1">
                        <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded text-blue-500 bg-white/5 border-white/20" />
                        Auto every 3s
                    </label>
                    <button type="button" onClick={clearLog} className="text-xs text-rose-300 px-2 py-1 active:opacity-70 ml-auto">
                        Clear log
                    </button>
                </div>
                <pre className="text-[10px] text-slate-300 font-mono bg-slate-950 rounded-lg p-2 max-h-[40vh] overflow-auto whitespace-pre-wrap break-all">
                    {tail.length === 0 ? '(empty — no events yet, or all modules are off)' : tail.join('\n')}
                </pre>
            </Section>
        </AppFrame>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
    </section>
);
