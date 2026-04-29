import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

export default function FaxConfig() {
    const [config, setConfig] = useState<{ configured: boolean; fromNumber: string | null; isActive: boolean; verifiedAt: string | null } | null>(null);
    const [apiToken, setApiToken] = useState('');
    const [signingKey, setSigningKey] = useState('');
    const [fromNumber, setFromNumber] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        axios.get('/api/faxplus/config').then((r) => {
            setConfig(r.data.config);
            if (r.data.config.fromNumber) setFromNumber(r.data.config.fromNumber);
        });
    }, []);

    const save = async () => {
        setBusy(true); setError(null); setSaved(false);
        try {
            const r = await axios.post('/api/faxplus/config', {
                api_token: apiToken,
                webhook_signing_key: signingKey || null,
                from_number: fromNumber,
            });
            setConfig(r.data.config);
            setApiToken(''); setSigningKey('');
            setSaved(true);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Save failed');
        } finally { setBusy(false); }
    };

    return (
        <AppFrame title="Fax (fax.plus)" back={route('settings.index')}>
            <Head title="Fax Settings" />

            {config?.configured && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/30 p-3 text-emerald-300 text-xs mb-4">
                    Connected · sender {config.fromNumber}
                </div>
            )}

            <div className="space-y-3">
                <Field label="API Token" type="password" value={apiToken} onChange={setApiToken} placeholder="••• from fax.plus dashboard" />
                <Field label="Webhook Signing Key" type="password" value={signingKey} onChange={setSigningKey} placeholder="HMAC-SHA256 key" />
                <Field label="From Number" value={fromNumber} onChange={setFromNumber} placeholder="+14155551212" mono />

                {error && <div className="text-rose-400 text-sm">{error}</div>}
                {saved && <div className="text-emerald-400 text-sm">Saved.</div>}

                <button
                    type="button"
                    onClick={save}
                    disabled={busy || !apiToken || !fromNumber}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {busy ? 'Saving…' : 'Save'}
                </button>

                <div className="rounded-2xl bg-amber-500/5 border border-amber-400/20 p-3 text-amber-200 text-xs leading-relaxed">
                    Twilio Programmable Fax was End-of-Life on 2021-12-17 — fax.plus is the named successor partner.
                    Run <span className="font-mono">php artisan faxplus:sync-webhooks</span> after starting ngrok.
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
