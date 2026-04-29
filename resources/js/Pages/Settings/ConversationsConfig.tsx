import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Config {
    configured: boolean;
    serviceSid: string | null;
    rcsAgentSid: string | null;
    whatsappFrom: string | null;
    facebookPageId: string | null;
    chatEnabled: boolean;
    rcsEnabled: boolean;
    whatsappEnabled: boolean;
    facebookEnabled: boolean;
    isActive: boolean;
}

export default function ConversationsConfig() {
    const [c, setC] = useState<Config | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        axios.get('/api/conversations-config').then((r) => setC(r.data.config));
    }, []);

    if (!c) {
        return (
            <AppFrame title="Conversations" back={route('settings.index')}>
                <Head title="Conversations Settings" />
                <div className="text-slate-400 text-sm text-center py-6">Loading…</div>
            </AppFrame>
        );
    }

    const update = (patch: Partial<Config>) => setC((prev) => prev ? { ...prev, ...patch } : prev);

    const save = async () => {
        if (!c) return;
        setBusy(true); setError(null); setSaved(false);
        try {
            await axios.post('/api/conversations-config', {
                service_sid: c.serviceSid,
                rcs_agent_sid: c.rcsAgentSid,
                whatsapp_from: c.whatsappFrom,
                facebook_page_id: c.facebookPageId,
                chat_enabled: c.chatEnabled,
                rcs_enabled: c.rcsEnabled,
                whatsapp_enabled: c.whatsappEnabled,
                facebook_enabled: c.facebookEnabled,
            });
            setSaved(true);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Save failed');
        } finally { setBusy(false); }
    };

    return (
        <AppFrame title="Conversations" back={route('settings.index')}>
            <Head title="Conversations Settings" />

            <div className="space-y-4">
                <Section title="Twilio service">
                    <Field label="Conversations Service SID" value={c.serviceSid ?? ''} onChange={(v) => update({ serviceSid: v })} placeholder="ISxxxxxxxx" mono />
                </Section>

                <Section title="Chat">
                    <Toggle label="Enable Chat" checked={c.chatEnabled} onChange={(v) => update({ chatEnabled: v })} hint="Identity-based web↔web chat. No external bindings required." />
                </Section>

                <Section title="RCS">
                    <Toggle label="Enable RCS" checked={c.rcsEnabled} onChange={(v) => update({ rcsEnabled: v })} />
                    <Field label="RCS Agent SID" value={c.rcsAgentSid ?? ''} onChange={(v) => update({ rcsAgentSid: v })} placeholder="rbm:agent_xxx" mono />
                </Section>

                <Section title="WhatsApp">
                    <Toggle label="Enable WhatsApp" checked={c.whatsappEnabled} onChange={(v) => update({ whatsappEnabled: v })} />
                    <Field label="WhatsApp From" value={c.whatsappFrom ?? ''} onChange={(v) => update({ whatsappFrom: v })} placeholder="+14155238886" mono />
                </Section>

                <Section title="Facebook Messenger">
                    <Toggle label="Enable Messenger" checked={c.facebookEnabled} onChange={(v) => update({ facebookEnabled: v })} />
                    <Field label="Facebook Page ID" value={c.facebookPageId ?? ''} onChange={(v) => update({ facebookPageId: v })} placeholder="123456789" mono />
                </Section>

                {error && <div className="text-rose-400 text-sm">{error}</div>}
                {saved && <div className="text-emerald-400 text-sm">Saved.</div>}

                <button
                    type="button"
                    onClick={save}
                    disabled={busy || !c.serviceSid}
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

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
    return (
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
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 rounded text-blue-500 bg-white/5 border-white/20" />
            <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{label}</div>
                {hint && <div className="text-xs text-slate-400 leading-snug">{hint}</div>}
            </div>
        </label>
    );
}
