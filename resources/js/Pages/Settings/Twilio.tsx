import AppFrame from '@/Layouts/AppFrame';
import { Head, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { FormEvent, useState } from 'react';
import axios from 'axios';

interface ConfigState {
    configured: boolean;
    accountSid: string | null;
    phoneNumber: string | null;
    twimlAppSid: string | null;
    verifiedAt: string | null;
}

export default function SettingsTwilio() {
    const { twilio } = usePage<PageProps>().props;
    const [sid, setSid] = useState('');
    const [token, setToken] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true); setError(null); setSuccess(null);
        try {
            const r = await axios.post('/api/twilio/config', { account_sid: sid, auth_token: token });
            setSuccess(r.data.message ?? 'Connected.');
            setSid(''); setToken('');
            router.reload({ only: ['twilio'] });
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; error?: string } } };
            setError(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to verify credentials.');
        } finally {
            setBusy(false);
        }
    };

    const disconnect = async () => {
        if (!confirm('Disconnect Twilio account? You can reconnect later.')) return;
        await axios.delete('/api/twilio/config');
        router.reload({ only: ['twilio'] });
    };

    return (
        <AppFrame title="Twilio Account" back={route('settings.index')}>
            <Head title="Twilio Account" />

            {twilio?.configured ? (
                <div className="space-y-4">
                    <div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/30 p-4">
                        <div className="text-emerald-300 text-xs font-semibold uppercase tracking-wide">Connected</div>
                        <div className="mt-1 text-white text-sm">
                            {twilio.phoneNumber ? (
                                <>Active number: <span className="font-mono">{twilio.phoneNumber}</span></>
                            ) : (
                                <>No number provisioned yet</>
                            )}
                        </div>
                    </div>
                    {!twilio.phoneNumber && (
                        <button
                            type="button"
                            onClick={() => router.visit(route('settings.numbers'))}
                            className="w-full bg-emerald-500 text-white rounded-xl py-3 font-semibold active:bg-emerald-600"
                        >
                            Pick a phone number →
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={disconnect}
                        className="w-full text-rose-400 text-sm py-3 active:opacity-60"
                    >
                        Disconnect Twilio account
                    </button>
                </div>
            ) : (
                <form onSubmit={submit} className="space-y-3">
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-4 text-amber-200 text-sm">
                        Get your Account SID + Auth Token from <span className="font-mono">console.twilio.com</span>. They'll be encrypted at rest.
                    </div>
                    <Field label="Account SID" placeholder="AC..." value={sid} onChange={setSid} mono />
                    <Field label="Auth Token" placeholder="32-char hex" value={token} onChange={setToken} mono type="password" />
                    {error && <div className="text-rose-400 text-sm">{error}</div>}
                    {success && <div className="text-emerald-400 text-sm">{success}</div>}
                    <button
                        type="submit"
                        disabled={busy || !sid || !token}
                        className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {busy ? 'Verifying with Twilio…' : 'Connect'}
                    </button>
                </form>
            )}
        </AppFrame>
    );
}

function Field({ label, value, onChange, placeholder, mono, type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; mono?: boolean; type?: string;
}) {
    return (
        <label className="block">
            <div className="text-xs text-slate-300 mb-1.5">{label}</div>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                type={type}
                autoComplete="off"
                spellCheck={false}
                className={`w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 ${mono ? 'font-mono text-sm' : ''}`}
            />
        </label>
    );
}
