import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

export default function MailConfig() {
    const [config, setConfig] = useState<{ configured: boolean; fromEmail: string | null; fromName: string | null; inboundHost: string | null; isActive: boolean; verifiedAt: string | null } | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [verifyKey, setVerifyKey] = useState('');
    const [fromEmail, setFromEmail] = useState('');
    const [fromName, setFromName] = useState('');
    const [inboundHost, setInboundHost] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        axios.get('/api/sendgrid/config').then((r) => {
            setConfig(r.data.config);
            if (r.data.config.fromEmail) setFromEmail(r.data.config.fromEmail);
            if (r.data.config.fromName) setFromName(r.data.config.fromName);
            if (r.data.config.inboundHost) setInboundHost(r.data.config.inboundHost);
        });
    }, []);

    const save = async () => {
        setBusy(true); setError(null); setSaved(false);
        try {
            const r = await axios.post('/api/sendgrid/config', {
                api_key: apiKey,
                webhook_verify_key: verifyKey || null,
                from_email: fromEmail,
                from_name: fromName || null,
                inbound_host: inboundHost || null,
            });
            setConfig(r.data.config);
            setApiKey(''); setVerifyKey('');
            setSaved(true);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Save failed');
        } finally { setBusy(false); }
    };

    return (
        <AppFrame title="Mail (SendGrid)" back={route('settings.index')}>
            <Head title="Mail Settings" />

            {config?.configured && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/30 p-3 text-emerald-300 text-xs mb-4">
                    Connected · {config.fromEmail}
                </div>
            )}

            <div className="space-y-3">
                <Field label="API Key" type="password" value={apiKey} onChange={setApiKey} placeholder="SG.•••" />
                <Field label="Event Webhook Verify Key (ECDSA public)" type="password" value={verifyKey} onChange={setVerifyKey} placeholder="MFkw…" />
                <Field label="From Email" type="email" value={fromEmail} onChange={setFromEmail} placeholder="hello@example.com" />
                <Field label="From Name" value={fromName} onChange={setFromName} placeholder="Your Company" />
                <Field label="Inbound Parse host (MX subdomain)" value={inboundHost} onChange={setInboundHost} placeholder="parse.example.com" mono />

                {error && <div className="text-rose-400 text-sm">{error}</div>}
                {saved && <div className="text-emerald-400 text-sm">Saved.</div>}

                <button
                    type="button"
                    onClick={save}
                    disabled={busy || !apiKey || !fromEmail}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {busy ? 'Saving…' : 'Save'}
                </button>

                <div className="rounded-2xl bg-blue-500/5 border border-blue-400/20 p-3 text-blue-200 text-xs leading-relaxed">
                    For Inbound Parse: add an MX record on the host above pointing to <span className="font-mono">mx.sendgrid.net</span> (priority 10).
                    Then set the Inbound Parse URL in SendGrid to <span className="font-mono break-all">{`{your-https-base}/webhooks/sendgrid/inbound`}</span>.
                </div>
            </div>
        </AppFrame>
    );
}

function Field({ label, value, onChange, placeholder, type, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean }) {
    return (
        <label className="block">
            <div className="text-xs text-slate-300 mb-1">{label}</div>
            <input
                type={type ?? 'text'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 ${mono ? 'font-mono text-sm' : 'text-sm'}`}
            />
        </label>
    );
}
