import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Template {
    id: number;
    name: string;
    sg_template_id: string | null;
    subject: string;
    variables: Record<string, string> | null;
    last_synced_at: string | null;
    updated_at: string;
}

export default function MailTemplates() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Template | null>(null);
    const [creating, setCreating] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/mail/templates');
            setTemplates(r.data.templates);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const sync = async () => {
        setSyncing(true); setSyncResult(null);
        try {
            const r = await axios.post('/api/mail/templates/sync');
            setSyncResult(`Imported ${r.data.imported} template${r.data.imported === 1 ? '' : 's'} from SendGrid.`);
            await load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setSyncResult(err.response?.data?.message ?? 'Sync failed');
        } finally {
            setSyncing(false);
            setTimeout(() => setSyncResult(null), 4000);
        }
    };

    const remove = async (id: number) => {
        if (!confirm('Delete this template?')) return;
        await axios.delete(`/api/mail/templates/${id}`);
        load();
    };

    return (
        <AppFrame
            title="Mail templates"
            back={route('mail.threads')}
            actions={
                <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60"
                >
                    New
                </button>
            }
        >
            <Head title="Mail templates" />

            {syncResult && (
                <div className="mb-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-2.5 text-emerald-300 text-xs">{syncResult}</div>
            )}

            <div className="flex gap-2 mb-3">
                <button
                    type="button"
                    onClick={sync}
                    disabled={syncing}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-slate-300 active:bg-white/10 disabled:opacity-50"
                >
                    {syncing ? 'Syncing…' : 'Sync from SendGrid'}
                </button>
            </div>

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && templates.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">
                    No templates yet. Create one or sync from SendGrid.
                </div>
            )}

            <div className="space-y-1.5">
                {templates.map((t) => (
                    <div key={t.id} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{t.name}</div>
                                <div className="text-xs text-slate-400 truncate">{t.subject}</div>
                                {t.sg_template_id && (
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">SG · {t.sg_template_id}</div>
                                )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button type="button" onClick={() => setEditing(t)} className="text-xs text-sky-300 px-2 py-1 active:opacity-70">Edit</button>
                                <button type="button" onClick={() => remove(t.id)} className="text-xs text-rose-300 px-2 py-1 active:opacity-70">Delete</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {(editing || creating) && (
                <Editor
                    template={editing}
                    onClose={() => { setEditing(null); setCreating(false); }}
                    onSaved={() => { setEditing(null); setCreating(false); load(); }}
                />
            )}
        </AppFrame>
    );
}

function Editor({ template, onClose, onSaved }: { template: Template | null; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(template?.name ?? '');
    const [subject, setSubject] = useState(template?.subject ?? '');
    const [bodyHtml, setBodyHtml] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Body html isn't returned from the index endpoint to keep the list lean.
        // For edit, this would need a separate fetch. For MVP we let the user
        // re-paste; new template creation works as expected.
        if (!template) setBodyHtml('');
    }, [template]);

    const save = async () => {
        if (!name.trim() || !subject.trim() || !bodyHtml.trim()) return;
        setBusy(true); setError(null);
        try {
            const payload = { name: name.trim(), subject: subject.trim(), body_html: bodyHtml };
            if (template) await axios.put(`/api/mail/templates/${template.id}`, payload);
            else await axios.post('/api/mail/templates', payload);
            onSaved();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Save failed');
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-2">
            <div className="w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-white/10 max-h-[85vh] flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
                    <div className="text-sm font-semibold text-white">{template ? 'Edit template' : 'New template'}</div>
                    <button type="button" onClick={onClose} className="text-slate-400 active:text-white text-2xl leading-none w-8 h-8" aria-label="Close">×</button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 no-scrollbar space-y-3">
                    <Field label="Name" value={name} onChange={setName} placeholder="Welcome email" />
                    <Field label="Subject" value={subject} onChange={setSubject} placeholder="Welcome, {{name}}!" />
                    <label className="block">
                        <div className="text-xs text-slate-300 mb-1">Body (HTML) — supports <span className="font-mono text-[10px]">{`{{name}}`} {`{{email}}`}</span></div>
                        <textarea
                            rows={10}
                            value={bodyHtml}
                            onChange={(e) => setBodyHtml(e.target.value)}
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-blue-400"
                        />
                    </label>
                </div>
                {error && <div className="px-4 py-2 text-rose-400 text-xs shrink-0">{error}</div>}
                <div className="px-4 py-3 border-t border-white/10 flex gap-2 shrink-0">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white/5 text-white text-sm py-2 active:bg-white/10">Cancel</button>
                    <button type="button" onClick={save} disabled={busy} className="flex-1 rounded-xl bg-blue-500 text-white text-sm font-semibold py-2 active:bg-blue-600 disabled:opacity-50">
                        {busy ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
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
