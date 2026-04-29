import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Template { id: number; name: string; body: string; variables: string[] }
interface Tag { id: number; name: string }
interface Contact { id: number; displayName: string; phoneE164: string }
interface Campaign {
    id: number; name: string; status: string;
    totalRecipients: number; sentCount: number; failedCount: number;
    startedAt: string | null; completedAt: string | null;
    template?: { id: number; name: string } | null;
}

export default function BulkSend() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);

    const [name, setName] = useState('');
    const [templateId, setTemplateId] = useState<number | null>(null);
    const [body, setBody] = useState('');
    const [pickedContacts, setPickedContacts] = useState<Set<number>>(new Set());
    const [pickedTags, setPickedTags] = useState<Set<number>>(new Set());
    const [extraNumbers, setExtraNumbers] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            axios.get('/api/sms-templates'),
            axios.get('/api/contacts'),
            axios.get('/api/bulk-sms'),
        ]).then(([t, c, ca]) => {
            setTemplates(t.data.templates);
            setContacts(c.data.contacts);
            setTags(c.data.tags);
            setCampaigns(ca.data.campaigns);
        });
    }, []);

    const reloadCampaigns = async () => {
        const r = await axios.get('/api/bulk-sms');
        setCampaigns(r.data.campaigns);
    };

    const onPickTemplate = (id: number | null) => {
        setTemplateId(id);
        if (id) {
            const t = templates.find((x) => x.id === id);
            if (t) setBody(t.body);
        }
    };

    const audienceCount = pickedContacts.size + pickedTags.size + extraNumbers.split(/[\s,;]+/).filter(Boolean).length;

    const send = async () => {
        setBusy(true); setError(null);
        try {
            const numbers = extraNumbers.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
            const r = await axios.post('/api/bulk-sms', {
                name,
                template_id: templateId,
                body: templateId ? null : body,
                audience: {
                    contact_ids: Array.from(pickedContacts),
                    tag_ids: Array.from(pickedTags),
                    numbers,
                },
                start_now: true,
            });
            setName(''); setBody(''); setTemplateId(null);
            setPickedContacts(new Set()); setPickedTags(new Set());
            setExtraNumbers('');
            await reloadCampaigns();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Failed to launch campaign');
        } finally { setBusy(false); }
    };

    const cancel = async (id: number) => {
        if (!confirm('Cancel this campaign? Pending recipients will not be sent.')) return;
        await axios.post(`/api/bulk-sms/${id}/cancel`);
        reloadCampaigns();
    };

    const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
        const next = new Set(set);
        if (next.has(value)) next.delete(value); else next.add(value);
        return next;
    };

    return (
        <AppFrame title="Bulk SMS" back={route('messages.threads')}>
            <Head title="Bulk SMS" />

            <div className="space-y-4">
                <Section title="New campaign">
                    <Field label="Name" value={name} onChange={setName} placeholder="Spring 2026 promo" />

                    <label className="block">
                        <div className="text-xs text-slate-300 mb-1">Template</div>
                        <select
                            aria-label="Template"
                            value={templateId ?? ''}
                            onChange={(e) => onPickTemplate(e.target.value ? Number(e.target.value) : null)}
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                        >
                            <option className="bg-slate-800" value="">— None (custom body) —</option>
                            {templates.map((t) => (
                                <option key={t.id} className="bg-slate-800" value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <div className="text-xs text-slate-300 mb-1">Body</div>
                        <textarea
                            rows={4}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            disabled={!!templateId}
                            placeholder="Hi {contact_name}, …"
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400 font-mono disabled:opacity-60"
                        />
                        <div className="text-[10px] text-slate-500 mt-1">Variables: <span className="font-mono">{'{contact_name}'}</span>, <span className="font-mono">{'{phone}'}</span></div>
                    </label>
                </Section>

                <Section title={`Audience · ${audienceCount} ${audienceCount === 1 ? 'recipient' : 'recipients'}`}>
                    {tags.length > 0 && (
                        <>
                            <div className="text-xs text-slate-300 mb-1">Tags</div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {tags.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setPickedTags(toggle(pickedTags, t.id))}
                                        className={`text-xs px-2 py-1 rounded-full border ${pickedTags.has(t.id) ? 'bg-blue-500/30 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-slate-300'}`}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="text-xs text-slate-300 mb-1">Contacts</div>
                    <div className="max-h-44 overflow-y-auto rounded-lg bg-white/5 border border-white/10 divide-y divide-white/10 mb-3">
                        {contacts.length === 0 && <div className="text-xs text-slate-400 px-3 py-2">No contacts.</div>}
                        {contacts.map((c) => (
                            <label key={c.id} className="flex items-center gap-2 px-3 py-2 active:bg-white/10 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={pickedContacts.has(c.id)}
                                    onChange={() => setPickedContacts(toggle(pickedContacts, c.id))}
                                    className="rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white truncate">{c.displayName}</div>
                                    <div className="text-xs text-slate-400 font-mono">{c.phoneE164}</div>
                                </div>
                            </label>
                        ))}
                    </div>

                    <label className="block">
                        <div className="text-xs text-slate-300 mb-1">Extra numbers (one per line, comma, or space-separated)</div>
                        <textarea
                            rows={2}
                            value={extraNumbers}
                            onChange={(e) => setExtraNumbers(e.target.value)}
                            placeholder="+1 555 555 0001, +1 555 555 0002"
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400 font-mono"
                        />
                    </label>
                </Section>

                {error && <div className="text-rose-400 text-sm">{error}</div>}

                <button
                    type="button"
                    onClick={send}
                    disabled={busy || !name.trim() || (!templateId && !body.trim()) || audienceCount === 0}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {busy ? 'Launching…' : `Send to ${audienceCount} recipients`}
                </button>

                <Section title="Recent campaigns">
                    {campaigns.length === 0 && <div className="text-slate-400 text-sm py-3 text-center">No campaigns yet.</div>}
                    <div className="space-y-1.5">
                        {campaigns.map((c) => (
                            <div key={c.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-sm text-white truncate">{c.name}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            {c.template ? `Template: ${c.template.name}` : 'Custom body'}
                                            {' · '}
                                            <StatusPill status={c.status} />
                                        </div>
                                    </div>
                                    {(c.status === 'queued' || c.status === 'running') && (
                                        <button type="button" onClick={() => cancel(c.id)} className="text-xs text-rose-300 px-2 py-1 active:opacity-70">
                                            Cancel
                                        </button>
                                    )}
                                </div>
                                <Progress sent={c.sentCount} failed={c.failedCount} total={c.totalRecipients} />
                            </div>
                        ))}
                    </div>
                </Section>
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

const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <label className="block">
        <div className="text-xs text-slate-300 mb-1">{label}</div>
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
        />
    </label>
);

const StatusPill = ({ status }: { status: string }) => {
    const map: Record<string, string> = {
        draft: 'bg-slate-500/20 text-slate-300',
        queued: 'bg-amber-500/20 text-amber-300',
        running: 'bg-blue-500/20 text-blue-300',
        completed: 'bg-emerald-500/20 text-emerald-300',
        failed: 'bg-rose-500/20 text-rose-300',
        canceled: 'bg-slate-500/20 text-slate-400',
    };
    return <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${map[status] ?? 'bg-slate-500/20 text-slate-300'}`}>{status}</span>;
};

const Progress = ({ sent, failed, total }: { sent: number; failed: number; total: number }) => {
    if (total === 0) return null;
    const sentPct = (sent / total) * 100;
    const failedPct = (failed / total) * 100;
    return (
        <div className="mt-2">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden flex">
                <div className="bg-emerald-500" style={{ width: `${sentPct}%` }} />
                <div className="bg-rose-500" style={{ width: `${failedPct}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
                {sent} sent · {failed} failed · {total - sent - failed} pending of {total}
            </div>
        </div>
    );
};
