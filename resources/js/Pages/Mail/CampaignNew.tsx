import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Template { id: number; name: string; subject: string }
interface Tag { id: number; name: string; color: string | null }
interface Contact { id: number; displayName: string; phoneE164: string; email: string | null; tags: Tag[] }

export default function MailCampaignNew() {
    const [name, setName] = useState('');
    const [templateId, setTemplateId] = useState<number | null>(null);
    const [subject, setSubject] = useState('');
    const [bodyHtml, setBodyHtml] = useState('');
    const [tagIds, setTagIds] = useState<number[]>([]);
    const [contactIds, setContactIds] = useState<number[]>([]);
    const [startNow, setStartNow] = useState(true);

    const [templates, setTemplates] = useState<Template[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        axios.get('/api/mail/templates').then((r) => setTemplates(r.data.templates ?? []));
        axios.get('/api/contacts').then((r) => {
            setContacts((r.data.contacts ?? []).filter((c: Contact) => c.email));
            setTags(r.data.tags ?? []);
        });
    }, []);

    const onTemplate = (id: string) => {
        const idNum = id ? Number(id) : null;
        setTemplateId(idNum);
        const t = templates.find((x) => x.id === idNum);
        if (t) setSubject(t.subject);
    };

    const toggleTag = (id: number) => {
        setTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    const toggleContact = (id: number) => {
        setContactIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    // Estimated reach: union of explicitly-picked contacts and contacts whose
    // tags intersect the selected tag set, deduped by lowercase email.
    const reachSet = new Set<string>();
    contacts.forEach((c) => {
        if (!c.email) return;
        const tagMatch = tagIds.length > 0 && c.tags.some((t) => tagIds.includes(t.id));
        const idMatch = contactIds.includes(c.id);
        if (tagMatch || idMatch) reachSet.add(c.email.toLowerCase());
    });

    const create = async () => {
        if (!name.trim() || !subject.trim() || (!templateId && !bodyHtml.trim())) return;
        setBusy(true); setError(null);
        try {
            const r = await axios.post('/api/mail/campaigns', {
                name: name.trim(),
                template_id: templateId,
                subject: subject.trim(),
                body_html: bodyHtml || null,
                tag_ids: tagIds,
                contact_ids: contactIds,
                start_now: startNow,
            });
            router.visit(route('mail.campaigns.show', r.data.campaign.id));
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            const msg = err.response?.data?.errors
                ? Object.values(err.response.data.errors).flat().join(' ')
                : err.response?.data?.message;
            setError(msg ?? 'Failed to create campaign');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppFrame title="New campaign" back={route('mail.campaigns')}>
            <Head title="New mail campaign" />

            <div className="space-y-4">
                <Section title="Details">
                    <Field label="Name" value={name} onChange={setName} placeholder="Q1 newsletter" />
                    <label className="block">
                        <div className="text-xs text-slate-300 mb-1">Template (optional)</div>
                        <select
                            value={templateId ?? ''}
                            onChange={(e) => onTemplate(e.target.value)}
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                        >
                            <option value="" className="bg-slate-800">— Custom subject + body —</option>
                            {templates.map((t) => (
                                <option key={t.id} value={t.id} className="bg-slate-800">{t.name}</option>
                            ))}
                        </select>
                    </label>
                    <Field label="Subject" value={subject} onChange={setSubject} placeholder="Hello, {{name}}!" />
                    {!templateId && (
                        <label className="block">
                            <div className="text-xs text-slate-300 mb-1">Body (HTML)</div>
                            <textarea
                                rows={6}
                                value={bodyHtml}
                                onChange={(e) => setBodyHtml(e.target.value)}
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-blue-400"
                            />
                        </label>
                    )}
                </Section>

                <Section title={`Audience · ${reachSet.size} recipient${reachSet.size === 1 ? '' : 's'}`}>
                    {tags.length > 0 && (
                        <div className="mb-3">
                            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">By tag</div>
                            <div className="flex flex-wrap gap-1.5">
                                {tags.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => toggleTag(t.id)}
                                        className={`text-[11px] px-2 py-1 rounded-full ${tagIds.includes(t.id) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400'}`}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">By contact</div>
                    <div className="max-h-48 overflow-y-auto no-scrollbar divide-y divide-white/10">
                        {contacts.map((c) => (
                            <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 active:bg-white/5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={contactIds.includes(c.id)}
                                    onChange={() => toggleContact(c.id)}
                                    className="rounded text-blue-500 bg-white/5 border-white/20"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white truncate">{c.displayName}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{c.email}</div>
                                </div>
                            </label>
                        ))}
                        {contacts.length === 0 && (
                            <div className="text-slate-500 text-xs text-center py-3">No contacts with email addresses.</div>
                        )}
                    </div>
                </Section>

                <Section title="Schedule">
                    <Toggle
                        label="Start sending immediately"
                        hint="Otherwise the campaign is created in draft state — you can start it from the campaign detail page."
                        checked={startNow}
                        onChange={setStartNow}
                    />
                </Section>

                {error && <div className="text-rose-400 text-sm">{error}</div>}

                <button
                    type="button"
                    onClick={create}
                    disabled={busy || !name.trim() || !subject.trim() || reachSet.size === 0 || (!templateId && !bodyHtml.trim())}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {busy ? 'Creating…' : startNow ? `Send to ${reachSet.size} recipient${reachSet.size === 1 ? '' : 's'}` : 'Save as draft'}
                </button>
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

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
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
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 rounded text-blue-500 bg-white/5 border-white/20" />
            <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{label}</div>
                {hint && <div className="text-xs text-slate-400 leading-snug">{hint}</div>}
            </div>
        </label>
    );
}
