import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Rule {
    id: number;
    name: string;
    priority: number;
    isEnabled: boolean;
    matchType: string;
    matchValue: Record<string, unknown>;
    action: string;
    actionTarget: Record<string, unknown>;
    timeWindow: Record<string, unknown>;
}
interface Agent { id: number; name: string; email: string; presence: string }

const MATCH_TYPES = [
    { value: 'any', label: 'Match every inbound call' },
    { value: 'number_pattern', label: 'Number pattern (prefix or regex)' },
    { value: 'from_country', label: 'From country' },
    { value: 'contact_tag', label: 'Caller has tag' },
    { value: 'time_window', label: 'Time window only' },
];
const ACTIONS = [
    { value: 'ring_user', label: 'Ring a single user' },
    { value: 'simultaneous_ring', label: 'Ring everyone at once (first answer wins)' },
    { value: 'round_robin', label: 'Round-robin between users' },
    { value: 'priority_list', label: 'Priority list (top to bottom)' },
    { value: 'skill_based', label: 'Skill-based (best match wins)' },
    { value: 'forward', label: 'Forward to a number' },
    { value: 'voicemail', label: 'Send to voicemail' },
    { value: 'queue', label: 'Drop into a hold queue' },
    { value: 'ivr', label: 'Hand off to an IVR flow' },
];

export default function RoutingEdit({ ruleId }: { ruleId: number }) {
    const [rule, setRule] = useState<Rule | null>(null);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        Promise.all([
            axios.get(`/api/routing-rules/${ruleId}`),
            axios.get('/api/routing-rules'),
        ]).then(([r, list]) => {
            setRule(r.data.rule);
            setAgents(list.data.agents);
        });
    }, [ruleId]);

    if (!rule) {
        return (
            <AppFrame title={`Rule #${ruleId}`} back={route('settings.routing')}>
                <Head title="Routing rule" />
                <div className="text-slate-400 text-sm text-center py-6">Loading…</div>
            </AppFrame>
        );
    }

    const update = (patch: Partial<Rule>) => setRule((prev) => prev ? { ...prev, ...patch } : prev);
    const updateMatchValue = (patch: Record<string, unknown>) =>
        update({ matchValue: { ...rule.matchValue, ...patch } });
    const updateActionTarget = (patch: Record<string, unknown>) =>
        update({ actionTarget: { ...rule.actionTarget, ...patch } });
    const updateTimeWindow = (patch: Record<string, unknown>) =>
        update({ timeWindow: { ...rule.timeWindow, ...patch } });

    const save = async () => {
        setBusy(true); setError(null); setSaved(false);
        try {
            await axios.put(`/api/routing-rules/${rule.id}`, {
                name: rule.name,
                priority: rule.priority,
                is_enabled: rule.isEnabled,
                match_type: rule.matchType,
                match_value: rule.matchValue,
                action: rule.action,
                action_target: rule.actionTarget,
                time_window: rule.timeWindow,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            setError(err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' ') : err.response?.data?.message ?? 'Save failed');
        } finally { setBusy(false); }
    };

    const remove = async () => {
        if (!confirm('Delete this rule?')) return;
        await axios.delete(`/api/routing-rules/${rule.id}`);
        router.visit(route('settings.routing'));
    };

    const userIds = (rule.actionTarget.user_ids as number[]) ?? [];
    const toggleAgent = (id: number) => {
        const next = userIds.includes(id) ? userIds.filter((x) => x !== id) : [...userIds, id];
        updateActionTarget({ user_ids: next });
    };
    const moveAgent = (id: number, dir: -1 | 1) => {
        const i = userIds.indexOf(id);
        if (i < 0) return;
        const j = i + dir;
        if (j < 0 || j >= userIds.length) return;
        const copy = userIds.slice();
        [copy[i], copy[j]] = [copy[j], copy[i]];
        updateActionTarget({ user_ids: copy });
    };

    return (
        <AppFrame title={rule.name} back={route('settings.routing')}>
            <Head title={`Rule: ${rule.name}`} />

            <div className="space-y-4">
                <Section title="Identity">
                    <Field label="Name" value={rule.name} onChange={(v) => update({ name: v })} />
                    <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                            <div className="text-xs text-slate-300 mb-1">Priority (lower = first)</div>
                            <input
                                type="number"
                                aria-label="Priority"
                                value={rule.priority}
                                min={0}
                                max={1000}
                                onChange={(e) => update({ priority: Number(e.target.value) })}
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                            />
                        </label>
                        <label className="flex items-center gap-2 px-1 mt-5">
                            <input
                                type="checkbox"
                                checked={rule.isEnabled}
                                onChange={(e) => update({ isEnabled: e.target.checked })}
                                className="rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
                            />
                            <span className="text-sm text-white">Enabled</span>
                        </label>
                    </div>
                </Section>

                <Section title="Match">
                    <SelectField
                        label="Trigger"
                        value={rule.matchType}
                        onChange={(v) => update({ matchType: v, matchValue: {} })}
                        options={MATCH_TYPES}
                    />
                    {rule.matchType === 'number_pattern' && (
                        <div className="space-y-2">
                            <Field label="Prefix (starts-with)" value={(rule.matchValue.prefix as string) ?? ''} onChange={(v) => updateMatchValue({ prefix: v })} placeholder="+1800" mono />
                            <Field label="Regex (advanced, no delimiters)" value={(rule.matchValue.regex as string) ?? ''} onChange={(v) => updateMatchValue({ regex: v })} placeholder="^\\+91" mono />
                        </div>
                    )}
                    {rule.matchType === 'from_country' && (
                        <Field label="ISO country code" value={(rule.matchValue.country as string) ?? ''} onChange={(v) => updateMatchValue({ country: v.toUpperCase() })} placeholder="IN" />
                    )}
                    {rule.matchType === 'contact_tag' && (
                        <p className="text-xs text-slate-400">Tag IDs are configured via the Contacts API for now.</p>
                    )}
                </Section>

                <Section title="Time window (optional)">
                    <p className="text-xs text-slate-400 mb-1">Leave blank to apply 24/7. Times are in {String(rule.timeWindow.tz ?? 'app default')}.</p>
                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-slate-400">Start
                            <input
                                type="time"
                                aria-label="Start time"
                                value={(rule.timeWindow.start as string) ?? ''}
                                onChange={(e) => updateTimeWindow({ start: e.target.value })}
                                className="block w-full mt-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm"
                            />
                        </label>
                        <label className="text-xs text-slate-400">End
                            <input
                                type="time"
                                aria-label="End time"
                                value={(rule.timeWindow.end as string) ?? ''}
                                onChange={(e) => updateTimeWindow({ end: e.target.value })}
                                className="block w-full mt-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm"
                            />
                        </label>
                    </div>
                    <Weekdays
                        value={(rule.timeWindow.weekdays as number[]) ?? [1, 2, 3, 4, 5]}
                        onChange={(v) => updateTimeWindow({ weekdays: v })}
                    />
                </Section>

                <Section title="Action">
                    <SelectField
                        label="Do what"
                        value={rule.action}
                        onChange={(v) => update({ action: v, actionTarget: {} })}
                        options={ACTIONS}
                    />

                    {['ring_user', 'simultaneous_ring', 'round_robin', 'priority_list', 'skill_based'].includes(rule.action) && (
                        <div className="mt-2">
                            <div className="text-xs text-slate-300 mb-1.5">Agents</div>
                            <div className="rounded-lg bg-white/5 border border-white/10 divide-y divide-white/10 max-h-56 overflow-y-auto">
                                {agents.map((a) => {
                                    const order = userIds.indexOf(a.id);
                                    const checked = order >= 0;
                                    return (
                                        <div key={a.id} className="px-3 py-2 flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleAgent(a.id)}
                                                aria-label={a.name}
                                                className="rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-white truncate">{a.name}</div>
                                                <div className="text-[11px] text-slate-400 truncate">{a.email} · {a.presence}</div>
                                            </div>
                                            {checked && rule.action === 'priority_list' && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-slate-400">#{order + 1}</span>
                                                    <button type="button" aria-label="Move up" onClick={() => moveAgent(a.id, -1)} className="text-xs text-slate-300 px-1.5 py-0.5 bg-white/5 rounded">↑</button>
                                                    <button type="button" aria-label="Move down" onClick={() => moveAgent(a.id, 1)} className="text-xs text-slate-300 px-1.5 py-0.5 bg-white/5 rounded">↓</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {rule.action === 'skill_based' && (
                                <SkillsEditor
                                    skills={(rule.matchValue.skills as string[]) ?? []}
                                    onChange={(s) => updateMatchValue({ skills: s })}
                                />
                            )}
                        </div>
                    )}

                    {rule.action === 'forward' && (
                        <Field label="Forward to (E.164)" value={(rule.actionTarget.e164 as string) ?? ''} onChange={(v) => updateActionTarget({ e164: v })} placeholder="+1 555…" mono />
                    )}

                    {rule.action === 'queue' && (
                        <div className="space-y-2">
                            <Field label="Queue name" value={(rule.actionTarget.queue_name as string) ?? ''} onChange={(v) => updateActionTarget({ queue_name: v })} placeholder="support" />
                            <Field label="Hold music URL (optional)" value={(rule.actionTarget.wait_url as string) ?? ''} onChange={(v) => updateActionTarget({ wait_url: v })} placeholder="https://twimlets.com/holdmusic?…" />
                        </div>
                    )}

                    {rule.action === 'ivr' && (
                        <Field label="IVR flow ID" value={String(rule.actionTarget.ivr_flow_id ?? '')} onChange={(v) => updateActionTarget({ ivr_flow_id: Number(v) || null })} placeholder="42" />
                    )}
                </Section>

                {error && <div className="text-rose-400 text-sm">{error}</div>}
                {saved && <div className="text-emerald-400 text-sm">Saved.</div>}

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={save}
                        disabled={busy || !rule.name.trim()}
                        className="flex-1 bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {busy ? 'Saving…' : 'Save'}
                    </button>
                    <button
                        type="button"
                        onClick={remove}
                        className="bg-rose-600/20 text-rose-300 border border-rose-400/40 rounded-xl px-4 py-3 text-sm font-semibold active:bg-rose-600/30"
                    >
                        Delete
                    </button>
                </div>
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

const Field = ({ label, value, onChange, placeholder, mono }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) => (
    <label className="block">
        <div className="text-xs text-slate-300 mb-1">{label}</div>
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 ${mono ? 'font-mono text-sm' : 'text-sm'}`}
        />
    </label>
);

const SelectField = ({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>;
}) => (
    <label className="block">
        <div className="text-xs text-slate-300 mb-1">{label}</div>
        <select
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
        >
            {options.map((o) => (
                <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>
            ))}
        </select>
    </label>
);

function Weekdays({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const toggle = (i: number) => {
        const d = i + 1;
        const next = value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort();
        onChange(next);
    };
    return (
        <div>
            <div className="text-xs text-slate-400 mb-1">Workdays</div>
            <div className="flex gap-1">
                {days.map((d, i) => (
                    <button
                        key={d}
                        type="button"
                        onClick={() => toggle(i)}
                        className={`flex-1 text-xs py-1 rounded ${value.includes(i + 1) ? 'bg-blue-500/30 text-white' : 'bg-white/5 text-slate-400'}`}
                    >
                        {d}
                    </button>
                ))}
            </div>
        </div>
    );
}

function SkillsEditor({ skills, onChange }: { skills: string[]; onChange: (v: string[]) => void }) {
    const [draft, setDraft] = useState('');
    return (
        <div className="mt-2">
            <div className="text-xs text-slate-300 mb-1">Required skills (any-of, ranked by overlap)</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
                {skills.map((s) => (
                    <span key={s} className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-200 flex items-center gap-1.5">
                        {s}
                        <button type="button" onClick={() => onChange(skills.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="text-blue-200/70">×</button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (draft.trim()) { onChange([...skills, draft.trim()]); setDraft(''); } } }}
                    placeholder="english, billing, support…"
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                />
                <button
                    type="button"
                    disabled={!draft.trim()}
                    onClick={() => { onChange([...skills, draft.trim()]); setDraft(''); }}
                    className="text-xs bg-white/10 text-white rounded-lg px-3 py-2 disabled:opacity-50 active:bg-white/20"
                >
                    Add
                </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Each user's <span className="font-mono">skills</span> JSON column is matched against this list. Set skills via the Team API.</p>
        </div>
    );
}
