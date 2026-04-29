import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Rule {
    id: number;
    mode: 'blacklist' | 'whitelist';
    patternType: 'exact' | 'prefix' | 'country';
    patternValue: string;
    phoneE164: string;
    reason: string | null;
}

export default function Blocklist() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);

    const [mode, setMode] = useState<'blacklist' | 'whitelist'>('blacklist');
    const [patternType, setPatternType] = useState<'exact' | 'prefix' | 'country'>('exact');
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/settings/blocklist');
            setRules(r.data.rules);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const add = async () => {
        if (!value.trim()) return;
        setBusy(true); setError(null);
        try {
            await axios.post('/api/settings/blocklist', {
                mode, pattern_type: patternType, pattern_value: value.trim(), reason: reason.trim() || null,
            });
            setValue(''); setReason('');
            load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            setError(err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' ') : err.response?.data?.message ?? 'Failed');
        } finally { setBusy(false); }
    };

    const remove = async (id: number) => {
        await axios.delete(`/api/settings/blocklist/${id}`);
        load();
    };

    const blacklist = rules.filter((r) => r.mode === 'blacklist');
    const whitelist = rules.filter((r) => r.mode === 'whitelist');

    const placeholder =
        patternType === 'exact' ? '+1 555 555 1212'
        : patternType === 'prefix' ? '+1800'
        : '+91';

    return (
        <AppFrame title="Blocklist" back={route('settings.index')}>
            <Head title="Blocklist" />

            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-400 px-1">Add rule</div>
                <div className="grid grid-cols-2 gap-2">
                    <select
                        aria-label="Rule mode"
                        title="Rule mode"
                        value={mode}
                        onChange={(e) => setMode(e.target.value as 'blacklist' | 'whitelist')}
                        className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option value="blacklist" className="bg-slate-800">Blacklist (block)</option>
                        <option value="whitelist" className="bg-slate-800">Whitelist (allow only)</option>
                    </select>
                    <select
                        aria-label="Match type"
                        title="Match type"
                        value={patternType}
                        onChange={(e) => setPatternType(e.target.value as 'exact' | 'prefix' | 'country')}
                        className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option value="exact" className="bg-slate-800">Exact</option>
                        <option value="prefix" className="bg-slate-800">Prefix</option>
                        <option value="country" className="bg-slate-800">Country</option>
                    </select>
                </div>
                <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 font-mono text-sm"
                />
                <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                />
                {error && <div className="text-rose-400 text-xs">{error}</div>}
                <button
                    type="button"
                    onClick={add}
                    disabled={!value.trim() || busy}
                    className="w-full bg-blue-500 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {busy ? 'Adding…' : 'Add rule'}
                </button>
            </div>

            <div className="mt-4 space-y-4">
                <RuleSection title="Blacklist" rules={blacklist} onRemove={remove} loading={loading} empty="No blocked numbers." />
                <RuleSection title="Whitelist (only these can call)" rules={whitelist} onRemove={remove} loading={loading} empty="No whitelist rules. (Adding any rule here switches to allowlist mode for this user.)" />
            </div>
        </AppFrame>
    );
}

function RuleSection({ title, rules, onRemove, loading, empty }: {
    title: string; rules: Rule[]; onRemove: (id: number) => void; loading: boolean; empty: string;
}) {
    return (
        <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-1">{title}</div>
            <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10 overflow-hidden">
                {loading && <div className="text-slate-400 text-sm py-3 text-center">Loading…</div>}
                {!loading && rules.length === 0 && <div className="text-slate-400 text-xs py-3 text-center px-4">{empty}</div>}
                {rules.map((r) => (
                    <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="font-mono text-sm text-white truncate">{r.patternValue}</div>
                            <div className="text-xs text-slate-400">
                                {r.patternType}{r.reason ? ` · ${r.reason}` : ''}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onRemove(r.id)}
                            className="text-rose-300 text-xs px-2 py-1 active:opacity-70"
                        >
                            Remove
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
