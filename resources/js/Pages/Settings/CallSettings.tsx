import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Settings {
    forwardAlwaysTo: string | null;
    forwardBusyTo: string | null;
    forwardNoAnswerTo: string | null;
    forwardUnreachableTo: string | null;
    noAnswerTimeoutSeconds: number;
    recordingEnabled: boolean;
    recordingAnnouncement: boolean;
    voicemailEnabled: boolean;
    voicemailGreetingUrl: string | null;
    defaultCallerId: string | null;
    ringtone: string;
    simultaneousRingTo: string[];
    autoLookupInbound: boolean;
    autoLookupOutbound: boolean;
    lookupCacheDays: number;
    speedDialSlots: Record<string, string>;
}

export default function CallSettings() {
    const [s, setS] = useState<Settings | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        axios.get('/api/settings/call').then((r) => setS(r.data.settings));
    }, []);

    if (!s) {
        return (
            <AppFrame title="Call Settings" back={route('settings.index')}>
                <Head title="Call Settings" />
                <div className="text-slate-400 text-sm text-center py-6">Loading…</div>
            </AppFrame>
        );
    }

    const update = (patch: Partial<Settings>) => setS((prev) => prev ? { ...prev, ...patch } : prev);

    const save = async () => {
        setBusy(true); setError(null); setSaved(false);
        try {
            const r = await axios.put('/api/settings/call', {
                forward_always_to: s.forwardAlwaysTo || null,
                forward_busy_to: s.forwardBusyTo || null,
                forward_no_answer_to: s.forwardNoAnswerTo || null,
                forward_unreachable_to: s.forwardUnreachableTo || null,
                no_answer_timeout_seconds: s.noAnswerTimeoutSeconds,
                recording_enabled: s.recordingEnabled,
                recording_announcement: s.recordingAnnouncement,
                voicemail_enabled: s.voicemailEnabled,
                voicemail_greeting_url: s.voicemailGreetingUrl || null,
                default_caller_id: s.defaultCallerId || null,
                ringtone: s.ringtone,
                simultaneous_ring_to: s.simultaneousRingTo,
                auto_lookup_inbound: s.autoLookupInbound,
                auto_lookup_outbound: s.autoLookupOutbound,
                lookup_cache_days: s.lookupCacheDays,
                speed_dial_slots: s.speedDialSlots,
            });
            setS(r.data.settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            const msg = err.response?.data?.errors
                ? Object.values(err.response.data.errors).flat().join(' ')
                : err.response?.data?.message;
            setError(msg ?? 'Save failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppFrame title="Call Settings" back={route('settings.index')}>
            <Head title="Call Settings" />

            <div className="space-y-5">
                <Section title="Forwarding">
                    <Field label="Always forward to" placeholder="+1 555…" value={s.forwardAlwaysTo ?? ''} onChange={(v) => update({ forwardAlwaysTo: v })} />
                    <Field label="When busy" placeholder="+1 555…" value={s.forwardBusyTo ?? ''} onChange={(v) => update({ forwardBusyTo: v })} />
                    <Field label="When no answer" placeholder="+1 555…" value={s.forwardNoAnswerTo ?? ''} onChange={(v) => update({ forwardNoAnswerTo: v })} />
                    <Field label="When unreachable" placeholder="+1 555…" value={s.forwardUnreachableTo ?? ''} onChange={(v) => update({ forwardUnreachableTo: v })} />
                    <NumberField label="Ring timeout (seconds)" min={5} max={120} value={s.noAnswerTimeoutSeconds} onChange={(v) => update({ noAnswerTimeoutSeconds: v })} />
                </Section>

                <Section title="Recording">
                    <Toggle label="Record all calls" hint="Both legs, dual-channel mp3 stored locally." checked={s.recordingEnabled} onChange={(v) => update({ recordingEnabled: v })} />
                    <Toggle label="Play recording announcement" hint="Plays before the call connects (recommended for compliance)." checked={s.recordingAnnouncement} onChange={(v) => update({ recordingAnnouncement: v })} />
                </Section>

                <Section title="Voicemail">
                    <Toggle label="Enable voicemail fallback" hint="Capture a voicemail when nobody answers and no forwarding is set." checked={s.voicemailEnabled} onChange={(v) => update({ voicemailEnabled: v })} />
                    <Field label="Custom greeting URL (mp3)" placeholder="https://…" value={s.voicemailGreetingUrl ?? ''} onChange={(v) => update({ voicemailGreetingUrl: v })} />
                </Section>

                <Section title="Outbound">
                    <Field label="Default caller ID" placeholder="+1 555…" mono value={s.defaultCallerId ?? ''} onChange={(v) => update({ defaultCallerId: v })} />
                </Section>

                <Section title="Simultaneous ring">
                    <p className="text-xs text-slate-400 mb-2">When ringing in the browser, also ring these numbers in parallel. First to answer wins.</p>
                    <ListEditor
                        items={s.simultaneousRingTo}
                        onChange={(v) => update({ simultaneousRingTo: v })}
                        placeholder="+1 555 555 1212"
                    />
                </Section>

                <Section title="Speed dial">
                    <p className="text-xs text-slate-400 mb-2">
                        Long-press digit keys 1–9 on the dialer to instantly dial these numbers. Key 0 is reserved for typing <span className="font-mono">+</span>.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((slot) => (
                            <label key={slot} className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-white/10 text-white text-sm font-light flex items-center justify-center shrink-0">{slot}</span>
                                <input
                                    value={s.speedDialSlots?.[slot] ?? ''}
                                    onChange={(e) => update({
                                        speedDialSlots: { ...(s.speedDialSlots ?? {}), [slot]: e.target.value },
                                    })}
                                    placeholder="+1 555…"
                                    className="flex-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-xs font-mono"
                                />
                            </label>
                        ))}
                    </div>
                </Section>

                <Section title="Caller-id lookup">
                    <Toggle
                        label="Auto-identify inbound calls"
                        hint="Twilio Lookup runs automatically on inbound calls from numbers not in your contacts. ~$0.01 per lookup, US/CA caller-name only."
                        checked={s.autoLookupInbound}
                        onChange={(v) => update({ autoLookupInbound: v })}
                    />
                    <Toggle
                        label="Auto-identify before outbound calls"
                        hint="Lookup runs synchronously before connecting when dialing a non-contact. Adds ~1s latency."
                        checked={s.autoLookupOutbound}
                        onChange={(v) => update({ autoLookupOutbound: v })}
                    />
                    <NumberField
                        label="Cache lookups for (days)"
                        min={1}
                        max={365}
                        value={s.lookupCacheDays}
                        onChange={(v) => update({ lookupCacheDays: v })}
                    />
                </Section>

                {error && <div className="text-rose-400 text-sm">{error}</div>}
                {saved && <div className="text-emerald-400 text-sm">Saved.</div>}

                <button
                    type="button"
                    onClick={save}
                    disabled={busy}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {busy ? 'Saving…' : 'Save'}
                </button>
            </div>
        </AppFrame>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-3">{children}</div>
    </section>
);

const Field = ({ label, value, onChange, placeholder, mono }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) => (
    <label className="block">
        <div className="text-xs text-slate-300 mb-1">{label}</div>
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 ${mono ? 'font-mono text-sm' : 'text-sm'}`}
        />
    </label>
);

const NumberField = ({ label, value, onChange, min, max }: {
    label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) => (
    <label className="block">
        <div className="text-xs text-slate-300 mb-1">{label}</div>
        <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-blue-400 text-sm"
        />
    </label>
);

const Toggle = ({ label, hint, checked, onChange }: {
    label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) => (
    <label className="flex items-start gap-3 cursor-pointer">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-1 rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
        />
        <div className="flex-1 min-w-0">
            <div className="text-sm text-white">{label}</div>
            {hint && <div className="text-xs text-slate-400 leading-snug">{hint}</div>}
        </div>
    </label>
);

const ListEditor = ({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) => {
    const [draft, setDraft] = useState('');
    return (
        <div className="space-y-2">
            {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 font-mono text-sm text-white px-3 py-2 rounded-xl bg-white/5 border border-white/10">{it}</span>
                    <button
                        type="button"
                        onClick={() => onChange(items.filter((_, j) => j !== i))}
                        className="text-rose-300 text-xs px-2 py-1"
                    >
                        Remove
                    </button>
                </div>
            ))}
            <div className="flex items-center gap-2">
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 font-mono text-sm"
                />
                <button
                    type="button"
                    disabled={!draft.trim()}
                    onClick={() => { onChange([...items, draft.trim()]); setDraft(''); }}
                    className="text-xs bg-white/10 text-white rounded-lg px-3 py-2 disabled:opacity-50 active:bg-white/20"
                >
                    Add
                </button>
            </div>
        </div>
    );
};
