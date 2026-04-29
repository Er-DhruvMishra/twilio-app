import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface Summary {
    window: { start: string; end: string; days: number };
    calls: { total: number; answered: number; missed: number; voicemail: number; missedRate: number; avgDurationSeconds: number };
    sms: { sent: number; received: number; failed: number };
    mail: { sent: number; received: number; delivered: number; opened: number; clicked: number; bounced: number };
    fax: { sent: number; received: number; success: number; failed: number; totalPages: number; spendCents: number };
    lookup: { total: number; manualSearch: number; incomingManual: number; incomingAuto: number; outgoingManual: number; outgoingAuto: number; spendCents: number };
    conversations: { total: number; byChannel: Record<string, number>; messagesSent: number };
    video: { rooms: number; totalMinutes: number; recordings: number };
    callsByDay: Array<{ day: string; count: number; inbound: number; outbound: number }>;
    topContacts: Array<{ id: number; name: string; phone: string; calls: number }>;
    agentBreakdown: Array<{ userId: number; name: string; calls: number; answered: number; missed: number }> | null;
}

type Tab = 'voice' | 'sms' | 'mail' | 'fax' | 'lookup' | 'conversations' | 'video';

const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'voice', label: 'Voice' },
    { key: 'sms', label: 'SMS' },
    { key: 'mail', label: 'Mail' },
    { key: 'fax', label: 'Fax' },
    { key: 'lookup', label: 'Lookup' },
    { key: 'conversations', label: 'Conv.' },
    { key: 'video', label: 'Video' },
];

export default function Analytics() {
    const [days, setDays] = useState(30);
    const [tab, setTab] = useState<Tab>('voice');
    const [data, setData] = useState<Summary | null>(null);

    useEffect(() => {
        axios.get('/api/analytics/summary', { params: { days } }).then((r) => setData(r.data));
    }, [days]);

    return (
        <AppFrame title="Analytics" back={route('settings.index')}>
            <Head title="Analytics" />

            <div className="flex gap-1.5 mb-3">
                {[7, 14, 30, 60, 90].map((d) => (
                    <button
                        key={d}
                        type="button"
                        onClick={() => setDays(d)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium ${days === d ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}
                    >
                        {d}d
                    </button>
                ))}
            </div>

            <div className="flex gap-1 mb-3 overflow-x-auto -mx-1 px-1 no-scrollbar">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${tab === t.key ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {!data && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}

            {data && tab === 'voice' && <VoiceTab data={data} />}
            {data && tab === 'sms' && <SmsTab data={data} />}
            {data && tab === 'mail' && <MailTab data={data} />}
            {data && tab === 'fax' && <FaxTab data={data} />}
            {data && tab === 'lookup' && <LookupTab data={data} />}
            {data && tab === 'conversations' && <ConvTab data={data} />}
            {data && tab === 'video' && <VideoTab data={data} />}
        </AppFrame>
    );
}

function VoiceTab({ data }: { data: Summary }) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <Stat label="Calls" value={data.calls.total} />
                <Stat label="Answered" value={data.calls.answered} hue="emerald" />
                <Stat label="Missed" value={data.calls.missed} hue="rose" />
                <Stat label="Voicemails" value={data.calls.voicemail} hue="amber" />
                <Stat label="Missed rate" value={`${Math.round(data.calls.missedRate * 100)}%`} hue="rose" />
                <Stat label="Avg duration" value={`${Math.floor(data.calls.avgDurationSeconds / 60)}:${(data.calls.avgDurationSeconds % 60).toString().padStart(2, '0')}`} />
            </div>
            <Section title="Calls by day">
                <Sparkline data={data.callsByDay} />
            </Section>
            {data.topContacts.length > 0 && (
                <Section title="Top contacts">
                    <div className="divide-y divide-white/10">
                        {data.topContacts.map((c) => (
                            <div key={c.id} className="py-2 flex items-center justify-between">
                                <div className="min-w-0">
                                    <div className="text-sm text-white truncate">{c.name}</div>
                                    <div className="text-xs text-slate-400 font-mono">{c.phone}</div>
                                </div>
                                <div className="text-sm text-blue-300 font-mono">{c.calls}</div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}
            {data.agentBreakdown && data.agentBreakdown.length > 0 && (
                <Section title="Agents">
                    <div className="divide-y divide-white/10">
                        {data.agentBreakdown.map((a) => (
                            <div key={a.userId} className="py-2 flex items-center justify-between">
                                <div className="text-sm text-white">{a.name}</div>
                                <div className="text-xs text-slate-400 font-mono">
                                    {a.answered}/{a.calls} answered · {a.missed} missed
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}
        </div>
    );
}

function SmsTab({ data }: { data: Summary }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            <Stat label="Sent" value={data.sms.sent} hue="emerald" />
            <Stat label="Received" value={data.sms.received} />
            <Stat label="Failed" value={data.sms.failed} hue="rose" />
        </div>
    );
}

function MailTab({ data }: { data: Summary }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <Stat label="Sent" value={data.mail.sent} hue="emerald" />
            <Stat label="Received" value={data.mail.received} />
            <Stat label="Delivered" value={data.mail.delivered} hue="emerald" />
            <Stat label="Opened" value={data.mail.opened} hue="sky" />
            <Stat label="Clicked" value={data.mail.clicked} hue="sky" />
            <Stat label="Bounced" value={data.mail.bounced} hue="rose" />
        </div>
    );
}

function FaxTab({ data }: { data: Summary }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <Stat label="Sent" value={data.fax.sent} hue="emerald" />
            <Stat label="Received" value={data.fax.received} />
            <Stat label="Success" value={data.fax.success} hue="emerald" />
            <Stat label="Failed" value={data.fax.failed} hue="rose" />
            <Stat label="Pages" value={data.fax.totalPages} />
            <Stat label="Spend" value={`$${(data.fax.spendCents / 100).toFixed(2)}`} hue="emerald" />
        </div>
    );
}

function LookupTab({ data }: { data: Summary }) {
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <Stat label="Total lookups" value={data.lookup.total} />
                <Stat label="Spend" value={`$${(data.lookup.spendCents / 100).toFixed(2)}`} hue="emerald" />
            </div>
            <Section title="By source">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <KV k="Manual search" v={data.lookup.manualSearch} />
                    <KV k="Incoming · manual" v={data.lookup.incomingManual} />
                    <KV k="Incoming · auto" v={data.lookup.incomingAuto} />
                    <KV k="Outgoing · manual" v={data.lookup.outgoingManual} />
                    <KV k="Outgoing · auto" v={data.lookup.outgoingAuto} />
                </div>
            </Section>
        </div>
    );
}

function ConvTab({ data }: { data: Summary }) {
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <Stat label="Conversations" value={data.conversations.total} />
                <Stat label="Messages" value={data.conversations.messagesSent} />
            </div>
            <Section title="By channel">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(data.conversations.byChannel ?? {}).map(([k, v]) => (
                        <KV key={k} k={k} v={v} />
                    ))}
                    {Object.keys(data.conversations.byChannel ?? {}).length === 0 && (
                        <div className="text-slate-500 text-xs col-span-2">No conversations.</div>
                    )}
                </div>
            </Section>
        </div>
    );
}

function VideoTab({ data }: { data: Summary }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            <Stat label="Rooms" value={data.video.rooms} />
            <Stat label="Total min" value={data.video.totalMinutes} hue="emerald" />
            <Stat label="Recordings" value={data.video.recordings} />
        </div>
    );
}

const Stat = ({ label, value, hue = 'slate' }: { label: string; value: number | string; hue?: string }) => {
    const tones: Record<string, string> = {
        slate: 'text-white',
        emerald: 'text-emerald-300',
        rose: 'text-rose-300',
        amber: 'text-amber-300',
        sky: 'text-sky-300',
    };
    return (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
            <div className={`text-2xl font-semibold mt-0.5 ${tones[hue]}`}>{value}</div>
        </div>
    );
};

const KV = ({ k, v }: { k: string; v: number | string }) => (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5">
        <span className="text-slate-300 capitalize">{k.replace('_', ' ')}</span>
        <span className="text-white font-mono tabular-nums">{v}</span>
    </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
    </section>
);

function Sparkline({ data }: { data: Array<{ day: string; count: number; inbound: number; outbound: number }> }) {
    const max = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);
    return (
        <div className="flex items-end gap-0.5 h-20">
            {data.map((d) => {
                const inH = (d.inbound / max) * 100;
                const outH = (d.outbound / max) * 100;
                return (
                    <div
                        key={d.day}
                        title={`${d.day}: ${d.count} (in ${d.inbound} / out ${d.outbound})`}
                        className="flex-1 min-w-[3px] flex flex-col-reverse gap-px"
                    >
                        <span className="bg-emerald-400" style={{ height: `${inH}%` }} />
                        <span className="bg-blue-400" style={{ height: `${outH}%` }} />
                    </div>
                );
            })}
        </div>
    );
}
