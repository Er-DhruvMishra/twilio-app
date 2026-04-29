import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useDeviceOptional } from '@/Components/TwilioDeviceProvider';

interface Contact {
    id: number;
    displayName: string;
    phoneE164: string;
    email: string | null;
    isFavorite: boolean;
    isBlocked: boolean;
    tags: Array<{ id: number; name: string; color: string | null }>;
    owner: { id: number; name: string } | null;
}

interface Tag { id: number; name: string; color: string | null }

export default function ContactsIndex() {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = (auth.user?.roles ?? []).includes('admin');
    const device = useDeviceOptional();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [tagFilter, setTagFilter] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/contacts', { params: { q: q || undefined, tag: tagFilter ?? undefined } });
            setContacts(r.data.contacts);
            setTags(r.data.tags);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [q, tagFilter]);

    const grouped = useMemo(() => {
        const g: Record<string, Contact[]> = {};
        contacts.forEach((c) => {
            const letter = (c.displayName?.[0] ?? '#').toUpperCase();
            const key = /[A-Z]/.test(letter) ? letter : '#';
            (g[key] ??= []).push(c);
        });
        return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
    }, [contacts]);

    const dial = async (e164: string) => {
        if (!device) return;
        try { await device.dial(e164); } catch { /* surfaced on dialer */ }
    };

    return (
        <AppFrame
            title="Contacts"
            back={route('home')}
            actions={
                <Link
                    href={route('contacts.create')}
                    className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60"
                >
                    Add
                </Link>
            }
        >
            <Head title="Contacts" />

            <div className="space-y-2 mb-3">
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by name, number, email"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                />
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            type="button"
                            onClick={() => setTagFilter(null)}
                            className={`text-[11px] px-2 py-1 rounded-full ${tagFilter === null ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}
                        >
                            All
                        </button>
                        {tags.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTagFilter(tagFilter === t.id ? null : t.id)}
                                className={`text-[11px] px-2 py-1 rounded-full ${tagFilter === t.id ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex gap-2">
                    <Link
                        href={route('contacts.import')}
                        className="text-xs text-slate-300 px-2 py-1 rounded bg-white/5 active:bg-white/10"
                    >
                        Import CSV
                    </Link>
                    <a
                        href="/api/contacts/export.csv"
                        className="text-xs text-slate-300 px-2 py-1 rounded bg-white/5 active:bg-white/10"
                    >
                        Export
                    </a>
                </div>
            </div>

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && contacts.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">
                    No contacts. <Link href={route('contacts.create')} className="text-sky-400">Add your first one →</Link>
                </div>
            )}

            <div className="space-y-4">
                {grouped.map(([letter, list]) => (
                    <div key={letter}>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 px-1 mb-1">{letter}</div>
                        <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10 overflow-hidden">
                            {list.map((c) => (
                                <div key={c.id} className="px-3 py-2.5 flex items-center gap-3">
                                    <Avatar name={c.displayName} />
                                    <button
                                        type="button"
                                        onClick={() => router.visit(route('contacts.edit', c.id))}
                                        className="flex-1 min-w-0 text-left active:opacity-70"
                                    >
                                        <div className="text-sm text-white truncate flex items-center gap-1.5">
                                            {c.isFavorite && <span className="text-amber-300">★</span>}
                                            {c.displayName}
                                        </div>
                                        <div className="text-xs text-slate-400 font-mono truncate">{c.phoneE164}</div>
                                        {(c.tags.length > 0 || (isAdmin && c.owner)) && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {isAdmin && c.owner && (
                                                    <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                                                        {c.owner.name}
                                                    </span>
                                                )}
                                                {c.tags.map((t) => (
                                                    <span key={t.id} className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                                                        {t.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                    <div className="flex items-center gap-1">
                                        <IconBtn label="Call" onClick={() => dial(c.phoneE164)}>
                                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                                                <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.05-.24c1.12.39 2.33.6 3.54.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.21.21 2.42.6 3.54a1 1 0 0 1-.24 1.05l-2.24 2.2z" />
                                            </svg>
                                        </IconBtn>
                                        <IconBtn
                                            label="Message"
                                            onClick={() => router.visit(`/messages/compose?to=${encodeURIComponent(c.phoneE164)}`)}
                                        >
                                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                        </IconBtn>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="w-8 h-8 rounded-full bg-white/5 active:bg-white/15 text-emerald-300 flex items-center justify-center"
        >
            {children}
        </button>
    );
}

function Avatar({ name }: { name: string }) {
    const initials = (name || '').replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '#';
    return (
        <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-slate-200 text-sm font-semibold">
            {initials}
        </div>
    );
}
