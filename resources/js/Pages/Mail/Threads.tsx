import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePrivateChannel } from '@/Hooks/useEcho';

interface Thread {
    id: number;
    subject: string;
    unread: number;
    mailCount: number;
    lastMailAt: string | null;
    preview: string;
    lastFrom: string | null;
    owner: { id: number; name: string } | null;
}

export default function MailThreads() {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = (auth.user?.roles ?? []).includes('admin');
    const canSend = (auth.user?.permissions ?? []).includes('send-mail');

    const [threads, setThreads] = useState<Thread[]>([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        axios.get('/api/mail/threads').then((r) => setThreads(r.data.threads)).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.MailReceived': () => load(),
        '.MailStatusUpdated': () => load(),
    });

    const canBulkMail = (auth.user?.permissions ?? []).includes('send-bulk-mail');
    const canManageTemplates = (auth.user?.permissions ?? []).includes('manage-mail-templates');

    return (
        <AppFrame
            title="Mail"
            back={route('home')}
            actions={canSend ? (
                <Link href={route('mail.compose')} className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60">New</Link>
            ) : undefined}
        >
            <Head title="Mail" />

            {(canManageTemplates || canBulkMail) && (
                <div className="flex gap-1.5 mb-3 overflow-x-auto -mx-1 px-1 no-scrollbar">
                    {canManageTemplates && (
                        <Link href={route('mail.templates')} className="text-xs text-slate-300 px-3 py-1.5 rounded-full bg-white/5 active:bg-white/10 whitespace-nowrap">Templates</Link>
                    )}
                    {canBulkMail && (
                        <Link href={route('mail.campaigns')} className="text-xs text-slate-300 px-3 py-1.5 rounded-full bg-white/5 active:bg-white/10 whitespace-nowrap">Campaigns</Link>
                    )}
                </div>
            )}

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && threads.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">
                    No mail yet.{canSend && <> <Link href={route('mail.compose')} className="text-sky-400">Compose →</Link></>}
                </div>
            )}

            <div className="space-y-1">
                {threads.map((t) => (
                    <Link
                        key={t.id}
                        href={route('mail.thread', t.id)}
                        className={`block rounded-xl px-3 py-2.5 active:bg-white/10 ${t.unread > 0 ? 'bg-blue-500/10' : ''}`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className={`text-sm truncate flex-1 ${t.unread > 0 ? 'text-white font-semibold' : 'text-slate-200'}`}>
                                {t.subject || '(no subject)'}
                            </div>
                            <div className="text-[10px] text-slate-500 shrink-0">{t.lastMailAt ? relativeTime(t.lastMailAt) : ''}</div>
                        </div>
                        <div className="text-xs text-slate-400 truncate mt-0.5">
                            {t.lastFrom && <span className="text-slate-500">{t.lastFrom} · </span>}
                            {t.preview}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-slate-500">{t.mailCount} {t.mailCount === 1 ? 'message' : 'messages'}</span>
                            {t.unread > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center">
                                    {t.unread > 99 ? '99+' : t.unread}
                                </span>
                            )}
                            {isAdmin && t.owner && (
                                <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{t.owner.name}</span>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </AppFrame>
    );
}

function relativeTime(iso: string): string {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
