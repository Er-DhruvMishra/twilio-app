import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Tag { id: number; name: string; color: string | null }

interface Props {
    mode: 'create' | 'edit';
    contactId?: number;
}

export default function ContactEdit({ mode, contactId }: Props) {
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    const [tagIds, setTagIds] = useState<number[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [newTag, setNewTag] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        axios.get('/api/contact-tags').then((r) => setTags(r.data.tags));
        if (mode === 'edit' && contactId) {
            axios.get(`/api/contacts/${contactId}`).then((r) => {
                const c = r.data.contact;
                setDisplayName(c.displayName ?? '');
                setPhone(c.phoneE164 ?? '');
                setEmail(c.email ?? '');
                setNotes(c.notes ?? '');
                setIsFavorite(!!c.isFavorite);
                setTagIds((c.tags ?? []).map((t: Tag) => t.id));
            });
        }
    }, [mode, contactId]);

    const save = async () => {
        setBusy(true); setError(null);
        try {
            const payload = {
                display_name: displayName.trim(),
                phone: phone.trim(),
                email: email.trim() || null,
                notes: notes.trim() || null,
                is_favorite: isFavorite,
                tag_ids: tagIds,
            };
            const r = mode === 'edit' && contactId
                ? await axios.put(`/api/contacts/${contactId}`, payload)
                : await axios.post('/api/contacts', payload);
            router.visit(route('contacts.edit', r.data.contact.id));
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            const msg = err.response?.data?.errors
                ? Object.values(err.response.data.errors).flat().join(' ')
                : err.response?.data?.message;
            setError(msg ?? 'Save failed');
        } finally {
            setBusy(false);
        }
    };

    const destroy = async () => {
        if (!contactId) return;
        if (!confirm('Delete this contact?')) return;
        await axios.delete(`/api/contacts/${contactId}`);
        router.visit(route('contacts.index'));
    };

    const addNewTag = async () => {
        const name = newTag.trim();
        if (!name) return;
        const r = await axios.post('/api/contact-tags', { name });
        setTags((prev) => prev.some((t) => t.id === r.data.tag.id) ? prev : [...prev, r.data.tag]);
        setTagIds((prev) => prev.includes(r.data.tag.id) ? prev : [...prev, r.data.tag.id]);
        setNewTag('');
    };

    const toggleTag = (id: number) => {
        setTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    return (
        <AppFrame title={mode === 'create' ? 'New Contact' : 'Edit Contact'} back={route('contacts.index')}>
            <Head title={mode === 'create' ? 'New Contact' : 'Edit Contact'} />

            <div className="space-y-3">
                <Field label="Name" value={displayName} onChange={setDisplayName} placeholder="Asha Patel" autoFocus />
                <Field label="Phone" value={phone} onChange={setPhone} placeholder="+1 555 555 1212" mono />
                <Field label="Email" value={email} onChange={setEmail} placeholder="asha@example.com" />
                <label className="block">
                    <div className="text-xs text-slate-300 mb-1.5">Notes</div>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                </label>

                <label className="flex items-center gap-2 px-1">
                    <input
                        type="checkbox"
                        checked={isFavorite}
                        onChange={(e) => setIsFavorite(e.target.checked)}
                        className="rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
                    />
                    <span className="text-sm text-white">Favorite</span>
                </label>

                <div>
                    <div className="text-xs text-slate-300 mb-1.5">Tags</div>
                    <div className="flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => toggleTag(t.id)}
                                className={`text-xs px-2 py-1 rounded-full border ${tagIds.includes(t.id) ? 'bg-blue-500/30 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-slate-300'}`}
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <input
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            placeholder="New tag…"
                            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-xs"
                        />
                        <button
                            type="button"
                            onClick={addNewTag}
                            disabled={!newTag.trim()}
                            className="text-xs bg-white/10 text-white rounded-lg px-2 py-1 disabled:opacity-50 active:bg-white/20"
                        >
                            Add tag
                        </button>
                    </div>
                </div>

                {error && <div className="text-rose-400 text-sm">{error}</div>}

                <div className="flex gap-2 pt-2">
                    <button
                        type="button"
                        onClick={save}
                        disabled={busy || !displayName.trim() || !phone.trim()}
                        className="flex-1 bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {busy ? 'Saving…' : mode === 'edit' ? 'Save' : 'Create'}
                    </button>
                    {mode === 'edit' && (
                        <button
                            type="button"
                            onClick={destroy}
                            className="bg-rose-600/20 text-rose-300 border border-rose-400/40 rounded-xl px-4 py-3 text-sm font-semibold active:bg-rose-600/30"
                        >
                            Delete
                        </button>
                    )}
                </div>
            </div>
        </AppFrame>
    );
}

function Field({ label, value, onChange, placeholder, mono, autoFocus }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; mono?: boolean; autoFocus?: boolean;
}) {
    return (
        <label className="block">
            <div className="text-xs text-slate-300 mb-1.5">{label}</div>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                className={`w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 ${mono ? 'font-mono text-sm' : 'text-sm'}`}
            />
        </label>
    );
}
