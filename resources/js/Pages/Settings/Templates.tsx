import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Template {
    id: number;
    name: string;
    body: string;
    variables: string[];
}

const BLANK = { name: '', body: 'Hi {contact_name}, …' };

export default function Templates() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<{ id?: number; name: string; body: string }>(BLANK);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/sms-templates');
            setTemplates(r.data.templates);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const save = async () => {
        setBusy(true); setError(null);
        try {
            if (draft.id) await axios.put(`/api/sms-templates/${draft.id}`, draft);
            else await axios.post('/api/sms-templates', draft);
            setDraft(BLANK);
            load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Save failed');
        } finally { setBusy(false); }
    };

    const remove = async (id: number) => {
        if (!confirm('Delete this template?')) return;
        await axios.delete(`/api/sms-templates/${id}`);
        load();
    };

    const detectedVars = Array.from(draft.body.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)).map((m) => m[1]);

    return (
        <AppFrame title="SMS Templates" back={route('settings.index')}>
            <Head title="SMS Templates" />

            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">{draft.id ? 'Edit template' : 'New template'}</div>
                <label className="block">
                    <div className="text-xs text-slate-300 mb-1">Name</div>
                    <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        placeholder="Welcome, Appointment reminder, …"
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                </label>
                <label className="block">
                    <div className="text-xs text-slate-300 mb-1">Body</div>
                    <textarea
                        rows={5}
                        value={draft.body}
                        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400 font-mono"
                    />
                    {detectedVars.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                            {Array.from(new Set(detectedVars)).map((v) => (
                                <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">{`{${v}}`}</span>
                            ))}
                        </div>
                    )}
                </label>

                {error && <div className="text-rose-400 text-xs">{error}</div>}

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={save}
                        disabled={busy || !draft.name.trim() || !draft.body.trim()}
                        className="flex-1 bg-blue-500 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {busy ? 'Saving…' : draft.id ? 'Save' : 'Add template'}
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

            <div className="mt-4 space-y-1.5">
                {loading && <div className="text-slate-400 text-sm text-center py-4">Loading…</div>}
                {!loading && templates.length === 0 && <div className="text-slate-400 text-sm text-center py-6">No templates yet.</div>}
                {templates.map((t) => (
                    <div key={t.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="text-sm text-white font-medium">{t.name}</div>
                            <div className="flex gap-1.5 shrink-0">
                                <button type="button" onClick={() => setDraft({ id: t.id, name: t.name, body: t.body })} className="text-xs text-sky-400 px-2 py-1 active:opacity-70">Edit</button>
                                <button type="button" onClick={() => remove(t.id)} className="text-xs text-rose-300 px-2 py-1 active:opacity-70">Delete</button>
                            </div>
                        </div>
                        <div className="text-xs text-slate-300 mt-1 whitespace-pre-wrap line-clamp-3 font-mono">{t.body}</div>
                        {t.variables.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                                {t.variables.map((v) => (
                                    <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">{`{${v}}`}</span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}
