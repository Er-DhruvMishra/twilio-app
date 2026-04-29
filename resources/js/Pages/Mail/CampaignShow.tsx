import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
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

interface Recipient { id: number; email: string; status: string; mailId: number | null }

export default function MailCampaignShow({ campaignId }: { campaignId: number }) {
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        try {
            const r = await axios.get(`/api/mail/campaigns/${campaignId}`);
            setCampaign(r.data.campaign);
            setRecipients(r.data.recipients);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [campaignId]);

    // Auto-poll while running so progress bars move without manual refresh.
    useEffect(() => {
        if (campaign?.status !== 'running' && campaign?.status !== 'queued') return;
        const id = setInterval(load, 2500);
        return () => clearInterval(id);
    }, [campaign?.status]);

    const start = async () => {
        setBusy(true);
        try {
            await axios.post(`/api/mail/campaigns/${campaignId}/start`);
            await load();
        } finally { setBusy(false); }
    };

    const cancel = async () => {
        if (!confirm('Cancel this campaign?')) return;
        setBusy(true);
        try {
            await axios.post(`/api/mail/campaigns/${campaignId}/cancel`);
            await load();
        } finally { setBusy(false); }
    };

    if (loading || !campaign) {
        return (
            <AppFrame title="Campaign" back={route('mail.campaigns')}>
                <Head title="Campaign" />
                <div className="text-slate-400 text-sm text-center py-6">Loading…</div>
            </AppFrame>
        );
    }

    const progress = campaign.totalRecipients > 0 ? Math.round((campaign.sentCount / campaign.totalRecipients) * 100) : 0;
    const canStart = campaign.status === 'draft';
    const canCancel = ['draft', 'queued', 'running'].includes(campaign.status);

    return (
        <AppFrame title={campaign.name} back={route('mail.campaigns')}>
            <Head title={campaign.name} />

            <Section title="Status">
                <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${statusColor(campaign.status)}`}>
                        {campaign.status}
                    </span>
                    <span className="text-xs text-slate-400">{campaign.subject}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                    <Stat label="Sent" value={`${campaign.sentCount}/${campaign.totalRecipients}`} />
                    <Stat label="Delivered" value={campaign.deliveredCount} />
                    <Stat label="Opened" value={campaign.openedCount} />
                    <Stat label="Clicked" value={campaign.clickedCount} />
                    <Stat label="Bounced" value={campaign.bouncedCount} hue="rose" />
                    <Stat label="Started" value={campaign.startedAt ? new Date(campaign.startedAt).toLocaleString() : '—'} />
                </div>
                <div className="h-2 mt-3 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-emerald-500/60 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex gap-2 mt-3">
                    {canStart && (
                        <button type="button" onClick={start} disabled={busy} className="flex-1 bg-emerald-500 text-white text-xs font-semibold rounded-lg py-2 active:bg-emerald-600 disabled:opacity-50">
                            {busy ? '…' : 'Start now'}
                        </button>
                    )}
                    {canCancel && (
                        <button type="button" onClick={cancel} disabled={busy} className="flex-1 bg-rose-500/80 text-white text-xs font-semibold rounded-lg py-2 active:bg-rose-600 disabled:opacity-50">
                            Cancel
                        </button>
                    )}
                </div>
            </Section>

            <Section title={`Recipients · ${recipients.length} shown`}>
                <div className="divide-y divide-white/10 max-h-[40vh] overflow-y-auto no-scrollbar">
                    {recipients.map((r) => (
                        <div key={r.id} className="py-1.5 flex items-center justify-between gap-2">
                            <div className="text-xs text-slate-200 truncate flex-1">{r.email}</div>
                            <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded shrink-0 ${recipientColor(r.status)}`}>
                                {r.status}
                            </span>
                        </div>
                    ))}
                </div>
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

function Stat({ label, value, hue }: { label: string; value: number | string; hue?: string }) {
    const color = hue === 'rose' ? 'text-rose-300' : 'text-white';
    return (
        <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
            <div className={`text-sm font-mono tabular-nums ${color}`}>{value}</div>
        </div>
    );
}

function statusColor(s: string): string {
    return ({
        draft: 'bg-slate-700/40 text-slate-300',
        queued: 'bg-amber-500/20 text-amber-300',
        running: 'bg-blue-500/20 text-blue-300',
        completed: 'bg-emerald-500/20 text-emerald-300',
        failed: 'bg-rose-500/20 text-rose-300',
        canceled: 'bg-slate-700/40 text-slate-400',
    })[s] ?? 'bg-slate-700/40 text-slate-300';
}

function recipientColor(s: string): string {
    return ({
        pending: 'bg-slate-700/40 text-slate-300',
        sent: 'bg-emerald-500/20 text-emerald-300',
        suppressed: 'bg-amber-500/20 text-amber-300',
        failed: 'bg-rose-500/20 text-rose-300',
    })[s] ?? 'bg-slate-700/40 text-slate-300';
}
