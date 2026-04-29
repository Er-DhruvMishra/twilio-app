import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Rule {
    id: number;
    name: string;
    matchType: 'always' | 'keyword' | 'first_contact' | 'outside_hours';
    matchValue: Record<string, unknown>;
    body: string;
    isEnabled: boolean;
    priority: number;
}

const BLANK: Omit<Rule, 'id'> = {
    name: '',
    matchType: 'keyword',
    matchValue: { keywords: [] as string[] },
    body: 'Thanks! We received your message and will get back to you shortly.',
    isEnabled: true,
    priority: 100,
};

export default function AutoReply() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<Omit<Rule, 'id'> & { id?: number }>(BLANK);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/auto-reply-rules');
            setRules(r.data.rules);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const save = async () => {
        setBusy(true); setError(null);
        try {
            const payload = {
                name: draft.name,
                match_type: draft.matchType,
                match_value: draft.matchValue,
                body: draft.body,
                is_enabled: draft.isEnabled,
                priority: draft.priority,
            };
            if (draft.id) {
                await axios.put(`/api/auto-reply-rules/${draft.id}`, payload);
            } else {
                await axios.post('/api/auto-reply-rules', payload);
            }
            setDraft(BLANK);
            load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Save failed');
        } finally { setBusy(false); }
    };

    const remove = async (id: number) => {
        if (!confirm('Delete this rule?')) return;
        await axios.delete(`/api/auto-reply-rules/${id}`);
        load();
    };

    const updateMatchValue = (patch: Record<string, unknown>) =>
        setDraft((d) => ({ ...d, matchValue: { ...d.matchValue, ...patch } }));

    return (
        <AppFrame title="Auto-Reply Rules" back={route('settings.index')}>
            <Head title="Auto-Reply Rules" />

            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">{draft.id ? 'Edit rule' : 'New rule'}</div>

                <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Out of hours, Lead capture, …" />

                <label className="block">
                    <div className="text-xs text-slate-300 mb-1">Trigger</div>
                    <select
                        aria-label="Trigger"
                        value={draft.matchType}
                        onChange={(e) => setDraft({ ...draft, matchType: e.target.value as Rule['matchType'], matchValue: {} })}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option className="bg-slate-800" value="always">Every inbound message</option>
                        <option className="bg-slate-800" value="keyword">Body contains keyword</option>
                        <option className="bg-slate-800" value="first_contact">First message from a new conversation</option>
                        <option className="bg-slate-800" value="outside_hours">Outside business hours</option>
                    </select>
                </label>

                {draft.matchType === 'keyword' && (
                    <KeywordsEditor
                        keywords={(draft.matchValue.keywords as string[]) ?? []}
                        onChange={(kw) => updateMatchValue({ keywords: kw })}
                    />
                )}

                {draft.matchType === 'outside_hours' && (
                    <HoursEditor value={draft.matchValue} onChange={updateMatchValue} />
                )}

                <label className="block">
                    <div className="text-xs text-slate-300 mb-1">Auto-reply body</div>
                    <textarea
                        rows={4}
                        value={draft.body}
                        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">Variables: <span className="font-mono">{'{from}'}</span>, <span className="font-mono">{'{contact_name}'}</span>, <span className="font-mono">{'{body}'}</span></div>
                </label>

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-white">
                        <input
                            type="checkbox"
                            checked={draft.isEnabled}
                            onChange={(e) => setDraft({ ...draft, isEnabled: e.target.checked })}
                            className="rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
                        />
                        Enabled
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                        Priority
                        <input
                            type="number"
                            min={0}
                            max={1000}
                            value={draft.priority}
                            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
                            aria-label="Priority"
                            className="w-16 rounded bg-white/5 border border-white/10 px-2 py-1 text-white text-xs"
                        />
                    </label>
                </div>

                {error && <div className="text-rose-400 text-xs">{error}</div>}

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={save}
                        disabled={busy || !draft.name.trim() || !draft.body.trim()}
                        className="flex-1 bg-blue-500 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Add rule'}
                    </button>
                    {draft.id && (
                        <button
                            type="button"
                            onClick={() => setDraft(BLANK)}
                            className="bg-white/5 border border-white/10 text-slate-300 rounded-xl px-3 py-2 text-sm active:bg-white/10"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-1">Rules</div>
                {loading && <div className="text-slate-400 text-sm text-center py-4">Loading…</div>}
                {!loading && rules.length === 0 && <div className="text-slate-400 text-sm text-center py-6">No rules yet.</div>}
                <div className="space-y-1.5">
                    {rules.map((r) => (
                        <div key={r.id} className={`rounded-xl border p-3 ${r.isEnabled ? 'bg-white/5 border-white/10' : 'bg-white/5 border-white/10 opacity-60'}`}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-sm text-white font-medium truncate">{r.name}</div>
                                    <div className="text-xs text-slate-400">
                                        Trigger: {labelTrigger(r)} · priority {r.priority}
                                    </div>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    <button type="button" onClick={() => setDraft({ ...r })} className="text-xs text-sky-400 px-2 py-1 active:opacity-70">Edit</button>
                                    <button type="button" onClick={() => remove(r.id)} className="text-xs text-rose-300 px-2 py-1 active:opacity-70">Delete</button>
                                </div>
                            </div>
                            <div className="mt-1.5 text-xs text-slate-300 whitespace-pre-wrap line-clamp-2">{r.body}</div>
                        </div>
                    ))}
                </div>
            </div>
        </AppFrame>
    );
}

function labelTrigger(r: Rule): string {
    switch (r.matchType) {
        case 'always': return 'Every inbound message';
        case 'keyword': return `Keyword: ${((r.matchValue.keywords as string[]) ?? []).join(', ')}`;
        case 'first_contact': return 'First message';
        case 'outside_hours': return 'Outside hours';
    }
}

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

function KeywordsEditor({ keywords, onChange }: { keywords: string[]; onChange: (kw: string[]) => void }) {
    const [draft, setDraft] = useState('');
    const add = () => { if (draft.trim()) { onChange([...keywords, draft.trim()]); setDraft(''); } };
    return (
        <div>
            <div className="text-xs text-slate-300 mb-1">Keywords (any-of, case-insensitive)</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
                {keywords.map((k, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-200 flex items-center gap-1.5">
                        {k}
                        <button type="button" onClick={() => onChange(keywords.filter((_, j) => j !== i))} className="text-blue-200/70" aria-label={`Remove ${k}`}>×</button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                    placeholder="hours, support, refund…"
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                />
                <button type="button" onClick={add} disabled={!draft.trim()} className="text-xs bg-white/10 text-white rounded-lg px-3 py-2 disabled:opacity-50 active:bg-white/20">Add</button>
            </div>
        </div>
    );
}

function HoursEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
    const start = (value.start as string) ?? '09:00';
    const end = (value.end as string) ?? '17:00';
    const weekdays = (value.weekdays as number[]) ?? [1, 2, 3, 4, 5];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const toggle = (i: number) => {
        const d = i + 1;
        const next = weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d].sort();
        onChange({ weekdays: next });
    };
    return (
        <div className="space-y-2">
            <div className="text-xs text-slate-300">Business hours</div>
            <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-400">Start
                    <input type="time" value={start} onChange={(e) => onChange({ start: e.target.value })} className="block w-full mt-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm" aria-label="Start time" />
                </label>
                <label className="text-xs text-slate-400">End
                    <input type="time" value={end} onChange={(e) => onChange({ end: e.target.value })} className="block w-full mt-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm" aria-label="End time" />
                </label>
            </div>
            <div className="text-xs text-slate-400">Workdays</div>
            <div className="flex gap-1">
                {days.map((d, i) => (
                    <button
                        key={d}
                        type="button"
                        onClick={() => toggle(i)}
                        className={`flex-1 text-xs py-1 rounded ${weekdays.includes(i + 1) ? 'bg-blue-500/30 text-white' : 'bg-white/5 text-slate-400'}`}
                    >
                        {d}
                    </button>
                ))}
            </div>
        </div>
    );
}
