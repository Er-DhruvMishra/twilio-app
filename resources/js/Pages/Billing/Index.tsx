import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Total {
    category: string;
    price_cents: number;
    count: number;
    usage: number;
    usage_unit: string | null;
}

interface Summary {
    source: 'cache' | 'live';
    window: { start: string; end: string };
    balance: { cents: number; currency: string };
    totals: Total[];
    records: Array<Record<string, unknown>>;
    fetchedAt?: string | null;
    error?: string | null;
}

type Period = 'today' | 'yesterday' | 'last_7' | 'last_30' | 'this_month' | 'last_month';

const PERIODS: Array<{ key: Period; label: string }> = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'last_7', label: 'Last 7 days' },
    { key: 'last_30', label: 'Last 30 days' },
    { key: 'this_month', label: 'This month' },
    { key: 'last_month', label: 'Last month' },
];

export default function BillingIndex() {
    const [period, setPeriod] = useState<Period>('last_30');
    const [data, setData] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async (live = false) => {
        if (live) setRefreshing(true); else setLoading(true);
        setError(null);
        try {
            const r = await axios.get('/api/billing/summary', { params: { period, live: live ? 1 : 0 } });
            setData(r.data);
            if (r.data.error) setError(r.data.error);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Failed to load billing');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { load(false); }, [period]);

    const refresh = async () => {
        setRefreshing(true);
        try {
            await axios.post('/api/billing/refresh', { period });
            await load(false);
        } catch {
            await load(true);
        } finally {
            setRefreshing(false);
        }
    };

    const balance = data?.balance;
    const balanceLow = balance ? balance.cents < 1000 : false;
    const totalSpend = (data?.totals ?? []).reduce((acc, t) => acc + t.price_cents, 0);

    return (
        <AppFrame
            title="Billing"
            back={route('home')}
            actions={
                <button
                    type="button"
                    onClick={refresh}
                    disabled={refreshing}
                    className="text-sky-400 text-xs font-semibold px-2 py-1 active:opacity-60 disabled:opacity-50"
                    title="Force a live fetch"
                >
                    {refreshing ? '⟳' : 'Refresh'}
                </button>
            }
        >
            <Head title="Billing" />

            {error && (
                <div className="mb-3 rounded-xl bg-rose-500/10 border border-rose-400/30 p-2.5 text-rose-300 text-xs">{error}</div>
            )}

            <Section title="Account balance">
                {loading && !data && <div className="text-slate-400 text-sm py-3 text-center">Loading…</div>}
                {balance && (
                    <div className={`rounded-xl p-3 ${balanceLow ? 'bg-rose-500/10 border border-rose-400/30' : 'bg-emerald-500/10 border border-emerald-400/30'}`}>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Current balance</div>
                        <div className="text-2xl font-mono text-white tabular-nums">
                            {formatMoney(balance.cents, balance.currency)}
                        </div>
                        {balanceLow && <div className="text-[10px] text-rose-300 mt-1">Low balance — top up via Twilio Console.</div>}
                        {data?.fetchedAt && (
                            <div className="text-[10px] text-slate-500 mt-1">
                                {data.source === 'cache' ? `Cached ${relativeTime(data.fetchedAt)}` : 'Live'}
                            </div>
                        )}
                    </div>
                )}
            </Section>

            <Section title="Window">
                <div className="flex flex-wrap gap-1.5">
                    {PERIODS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setPeriod(p.key)}
                            className={`text-xs px-3 py-1.5 rounded-full font-medium ${period === p.key ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {data?.window && (
                    <div className="text-[10px] text-slate-500 mt-2">
                        {data.window.start} → {data.window.end}
                    </div>
                )}
            </Section>

            <Section title={`Spend by category · ${formatMoney(totalSpend, balance?.currency ?? 'USD')}`}>
                {loading && <div className="text-slate-400 text-sm py-3 text-center">Loading…</div>}
                {!loading && data?.totals.length === 0 && (
                    <div className="text-slate-400 text-sm text-center py-6">No usage in this window.</div>
                )}
                <div className="divide-y divide-white/10">
                    {(data?.totals ?? []).map((t) => {
                        const pct = totalSpend ? (t.price_cents / totalSpend) * 100 : 0;
                        return (
                            <div key={t.category} className="py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm text-white truncate flex-1 font-mono">{prettyCategory(t.category)}</div>
                                    <div className="text-sm text-emerald-300 font-mono shrink-0 tabular-nums">
                                        {formatMoney(t.price_cents, balance?.currency ?? 'USD')}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                                    <div>
                                        {t.count > 0 && <span>{t.count.toLocaleString()} {t.count === 1 ? 'event' : 'events'}</span>}
                                        {t.usage > 0 && t.usage_unit && (
                                            <span> · {t.usage.toLocaleString(undefined, { maximumFractionDigits: 2 })} {t.usage_unit}</span>
                                        )}
                                    </div>
                                    <div>{pct.toFixed(1)}%</div>
                                </div>
                                <div className="h-1 mt-1 rounded-full bg-white/5 overflow-hidden">
                                    <div className="h-full bg-emerald-500/60" style={{ width: `${Math.max(2, pct)}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Section>
        </AppFrame>
    );
}

function formatMoney(cents: number, currency: string): string {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    return `${sign}${currency} ${(abs / 100).toFixed(2)}`;
}

function prettyCategory(c: string): string {
    return c.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function relativeTime(iso: string): string {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleString();
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
    </section>
);
