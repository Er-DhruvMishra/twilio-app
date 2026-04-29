import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface DayStat {
    date: string;
    stats: Array<{ metrics: Record<string, number> }>;
}

export default function MailStats() {
    const [stats, setStats] = useState<DayStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        axios.get('/api/mail/stats').then((r) => {
            if (r.data.error) setError(r.data.error);
            setStats(r.data.stats ?? []);
        }).finally(() => setLoading(false));
    }, []);

    const totals = stats.reduce((acc, day) => {
        const m = day.stats?.[0]?.metrics ?? {};
        acc.delivered += m.delivered ?? 0;
        acc.opens += m.unique_opens ?? m.opens ?? 0;
        acc.clicks += m.unique_clicks ?? m.clicks ?? 0;
        acc.bounces += m.bounces ?? 0;
        acc.spam += m.spam_reports ?? 0;
        acc.unsubscribes += m.unsubscribes ?? 0;
        return acc;
    }, { delivered: 0, opens: 0, clicks: 0, bounces: 0, spam: 0, unsubscribes: 0 });

    return (
        <AppFrame title="Mail stats" back={route('mail.threads')}>
            <Head title="Mail stats" />

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {error && <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3 text-rose-300 text-xs mb-3">{error}</div>}

            {!loading && (
                <div className="grid grid-cols-2 gap-2">
                    <Card label="Delivered" value={totals.delivered} color="text-emerald-300" />
                    <Card label="Unique opens" value={totals.opens} color="text-sky-300" />
                    <Card label="Unique clicks" value={totals.clicks} color="text-blue-300" />
                    <Card label="Bounces" value={totals.bounces} color="text-rose-300" />
                    <Card label="Spam reports" value={totals.spam} color="text-rose-400" />
                    <Card label="Unsubscribes" value={totals.unsubscribes} color="text-amber-300" />
                </div>
            )}
        </AppFrame>
    );
}

function Card({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
            <div className={`text-2xl font-mono tabular-nums ${color}`}>{value.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">{label}</div>
        </div>
    );
}
