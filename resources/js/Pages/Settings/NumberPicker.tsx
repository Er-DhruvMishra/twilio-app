import AppFrame from '@/Layouts/AppFrame';
import { Head, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';

interface AvailableNumber {
    phoneNumber: string;
    friendlyName: string;
    locality: string | null;
    region: string | null;
    isoCountry: string;
    capabilities: { voice: boolean; sms: boolean; mms: boolean; fax: boolean };
}

interface OwnedNumber {
    sid: string;
    phoneNumber: string;
    friendlyName: string;
    voiceUrl: string;
    smsUrl: string;
    capabilities: { voice: boolean; sms: boolean; mms: boolean; fax: boolean };
}

const COMMON_COUNTRIES = [
    { code: 'US', label: 'United States' },
    { code: 'CA', label: 'Canada' },
    { code: 'GB', label: 'United Kingdom' },
    { code: 'IN', label: 'India' },
    { code: 'AU', label: 'Australia' },
    { code: 'DE', label: 'Germany' },
    { code: 'FR', label: 'France' },
    { code: 'NL', label: 'Netherlands' },
    { code: 'SG', label: 'Singapore' },
    { code: 'JP', label: 'Japan' },
    { code: 'BR', label: 'Brazil' },
    { code: 'MX', label: 'Mexico' },
];

export default function NumberPicker() {
    const { twilio } = usePage<PageProps>().props;

    const [owned, setOwned] = useState<{ active_sid: string | null; numbers: OwnedNumber[] } | null>(null);
    const [ownedLoading, setOwnedLoading] = useState(false);
    const [usingSid, setUsingSid] = useState<string | null>(null);

    const [country, setCountry] = useState('US');
    const [areaCode, setAreaCode] = useState('');
    const [contains, setContains] = useState('');
    const [results, setResults] = useState<AvailableNumber[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [buying, setBuying] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!twilio?.configured) return;
        loadOwned();
    }, [twilio?.configured]);

    const loadOwned = async () => {
        setOwnedLoading(true);
        try {
            const r = await axios.get('/api/numbers/owned');
            setOwned(r.data);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Could not load your existing numbers.');
        } finally {
            setOwnedLoading(false);
        }
    };

    const useOwned = async (sid: string, phoneNumber: string) => {
        if (!confirm(`Use ${phoneNumber} as the active number? Its webhooks will be repointed at this app.`)) return;
        setUsingSid(sid); setError(null); setSuccess(null);
        try {
            const r = await axios.post('/api/numbers/use', { sid });
            setSuccess(r.data.message);
            router.reload({ only: ['twilio'] });
            await loadOwned();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Failed to set active number.');
        } finally {
            setUsingSid(null);
        }
    };

    const search = async (e?: FormEvent) => {
        e?.preventDefault();
        setSearching(true); setError(null); setResults(null);
        try {
            const r = await axios.get('/api/numbers/search', {
                params: { country, area_code: areaCode || undefined, contains: contains || undefined },
            });
            setResults(r.data.numbers);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Search failed.');
        } finally {
            setSearching(false);
        }
    };

    const buy = async (phoneNumber: string) => {
        if (!confirm(`Buy ${phoneNumber}? Twilio will charge your account.`)) return;
        setBuying(phoneNumber); setError(null); setSuccess(null);
        try {
            const r = await axios.post('/api/numbers/buy', { phone_number: phoneNumber });
            setSuccess(r.data.message);
            router.reload({ only: ['twilio'] });
            setResults(null);
            await loadOwned();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Purchase failed.');
        } finally {
            setBuying(null);
        }
    };

    if (!twilio?.configured) {
        return (
            <AppFrame title="Phone Numbers" back={route('settings.index')}>
                <Head title="Phone Numbers" />
                <div className="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-4 text-amber-200 text-sm">
                    Connect a Twilio account first.
                </div>
                <button
                    type="button"
                    onClick={() => router.visit(route('settings.twilio'))}
                    className="mt-3 w-full bg-blue-500 text-white rounded-xl py-3 font-semibold active:bg-blue-600"
                >
                    Go to Twilio settings
                </button>
            </AppFrame>
        );
    }

    return (
        <AppFrame title="Phone Numbers" back={route('settings.index')}>
            <Head title="Phone Numbers" />

            {twilio?.webhookPublic === false && (
                <div className="mb-3 rounded-2xl bg-amber-500/10 border border-amber-400/30 p-4 text-amber-200 text-sm leading-relaxed">
                    <div className="font-semibold text-amber-300 mb-1">Webhook URL is local-only</div>
                    Twilio can't reach <span className="font-mono">{twilio.webhookBaseUrl}</span>. Run <span className="font-mono bg-black/30 px-1 rounded">php artisan dev:start</span> to spin up ngrok and re-sync webhooks automatically.
                </div>
            )}

            {error && <div className="mb-3 rounded-xl bg-rose-500/10 border border-rose-400/30 p-3 text-rose-300 text-sm">{error}</div>}
            {success && <div className="mb-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-3 text-emerald-300 text-sm">{success}</div>}

            <Section title="On your Twilio account">
                {ownedLoading && <div className="text-slate-400 text-sm">Loading…</div>}
                {!ownedLoading && owned && owned.numbers.length === 0 && (
                    <div className="text-slate-400 text-sm">No numbers on this account yet. Search below to buy one.</div>
                )}
                {!ownedLoading && owned && owned.numbers.length > 0 && (
                    <div className="space-y-2">
                        {owned.numbers.map((n) => {
                            const isActive = n.sid === owned.active_sid;
                            return (
                                <div key={n.sid} className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-white text-sm">{n.phoneNumber}</span>
                                            {isActive && (
                                                <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                        {n.friendlyName && n.friendlyName !== n.phoneNumber && (
                                            <div className="text-xs text-slate-400 mt-0.5 truncate">{n.friendlyName}</div>
                                        )}
                                        <CapsRow caps={n.capabilities} />
                                    </div>
                                    {!isActive && (
                                        <button
                                            type="button"
                                            disabled={usingSid !== null}
                                            onClick={() => useOwned(n.sid, n.phoneNumber)}
                                            className="bg-blue-500 text-white rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 active:bg-blue-600 shrink-0"
                                        >
                                            {usingSid === n.sid ? 'Setting…' : 'Use this'}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>

            <Section title="Buy a new number">
                <form onSubmit={search} className="space-y-3">
                    <label className="block">
                        <div className="text-xs text-slate-300 mb-1.5">Country</div>
                        <select
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white focus:outline-none focus:border-blue-400"
                        >
                            {COMMON_COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code} className="bg-slate-800">
                                    {c.label} ({c.code})
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <div className="text-xs text-slate-300 mb-1.5">Area code</div>
                            <input
                                value={areaCode}
                                onChange={(e) => setAreaCode(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="415"
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                            />
                        </label>
                        <label className="block">
                            <div className="text-xs text-slate-300 mb-1.5">Contains</div>
                            <input
                                value={contains}
                                onChange={(e) => setContains(e.target.value)}
                                placeholder="555"
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                            />
                        </label>
                    </div>
                    <button
                        type="submit"
                        disabled={searching}
                        className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {searching ? 'Searching…' : 'Search'}
                    </button>
                </form>

                {results !== null && (
                    <div className="mt-4 space-y-2">
                        {results.length === 0 ? (
                            <div className="text-slate-400 text-sm text-center py-6">No numbers matched.</div>
                        ) : (
                            results.map((n) => (
                                <div key={n.phoneNumber} className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-mono text-white text-sm">{n.phoneNumber}</div>
                                        <div className="text-xs text-slate-400 mt-0.5 truncate">
                                            {[n.locality, n.region, n.isoCountry].filter(Boolean).join(', ')}
                                        </div>
                                        <CapsRow caps={n.capabilities} />
                                    </div>
                                    <button
                                        type="button"
                                        disabled={buying !== null}
                                        onClick={() => buy(n.phoneNumber)}
                                        className="bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 active:bg-emerald-600 shrink-0"
                                    >
                                        {buying === n.phoneNumber ? 'Buying…' : 'Buy'}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </Section>
        </AppFrame>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-6">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        {children}
    </section>
);

interface Caps { voice: boolean; sms: boolean; mms: boolean; fax: boolean }

const CapsRow = ({ caps }: { caps: Caps }) => (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
        <Cap label="Voice" on={caps.voice} />
        <Cap label="SMS" on={caps.sms} />
        <Cap label="MMS" on={caps.mms} />
        <Cap label="Fax" on={caps.fax} />
    </div>
);

const Cap = ({ label, on }: { label: string; on: boolean }) => (
    <span
        title={on ? `${label}: supported` : `${label}: not supported`}
        className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${on ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-slate-500 line-through decoration-slate-600/70'}`}
    >
        {label}
    </span>
);

const Tag = ({ children }: { children: React.ReactNode }) => (
    <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
        {children}
    </span>
);
