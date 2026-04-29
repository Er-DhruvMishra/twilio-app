import AppFrame from '@/Layouts/AppFrame';
import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Campaign {
    id: number;
    name: string;
    subject: string;
    status: 'draft' | 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
    template: { id: number; name: string } | null;
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    openedCount: number;
    clickedCount: number;
    bouncedCount: number;
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-slate-700/40 text-slate-300',
    queued: 'bg-amber-500/20 text-amber-300',
    running: 'bg-blue-500/20 text-blue-300',
    completed: 'bg-emerald-500/20 text-emerald-300',
    failed: 'bg-rose-500/20 text-rose-300',
    canceled: 'bg-slate-700/40 text-slate-400',
};

export default function MailCampaigns() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/mail/campaigns');
            setCampaigns(r.data.campaigns);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    return (
        <AppFrame
            title="Mail campaigns"
            back={route('mail.threads')}
            actions={
                <Link href={route('mail.campaigns.new')} className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60">
                    New
                </Link>
            }
        >
            <Head title="Mail campaigns" />

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && campaigns.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">
                    No campaigns yet. <Link href={route('mail.campaigns.new')} className="text-sky-400">Create one →</Link>
                </div>
            )}

            <div className="space-y-1.5">
                {campaigns.map((c) => {
                    const progress = c.totalRecipients > 0 ? Math.round((c.sentCount / c.totalRecipients) * 100) : 0;
                    return (
                        <Link
                            key={c.id}
                            href={route('mail.campaigns.show', c.id)}
                            className="block rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 active:bg-white/10"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white truncate">{c.name}</div>
                                    <div className="text-xs text-slate-400 truncate">{c.subject}</div>
                                </div>
                                <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLORS[c.status]}`}>
                                    {c.status}
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                {c.sentCount}/{c.totalRecipients} sent · {c.openedCount} opened · {c.bouncedCount} bounced
                            </div>
                            {c.totalRecipients > 0 && (c.status === 'running' || c.status === 'completed') && (
                                <div className="h-1 mt-1 rounded-full bg-white/5 overflow-hidden">
                                    <div className="h-full bg-emerald-500/60" style={{ width: `${progress}%` }} />
                                </div>
                            )}
                        </Link>
                    );
                })}
            </div>
        </AppFrame>
    );
}
