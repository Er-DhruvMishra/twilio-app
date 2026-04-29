import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Mail {
    id: number;
    direction: 'inbound' | 'outbound';
    from: string;
    fromName: string | null;
    to: string;
    cc: string | null;
    subject: string | null;
    bodyHtml: string | null;
    bodyText: string | null;
    status: string;
    sentAt: string | null;
    attachments: Array<{ id: number; name: string; contentType: string; sizeBytes: number }>;
}

export default function MailThread({ threadId }: { threadId: number }) {
    const [mails, setMails] = useState<Mail[]>([]);
    const [subject, setSubject] = useState('');
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<number | null>(null);

    useEffect(() => {
        axios.get(`/api/mail/threads/${threadId}`).then((r) => {
            setMails(r.data.mails);
            setSubject(r.data.thread.subject);
            if (r.data.mails.length > 0) setOpenId(r.data.mails[r.data.mails.length - 1].id);
        }).finally(() => setLoading(false));
    }, [threadId]);

    const reply = () => {
        const last = mails[mails.length - 1];
        const replyTo = last?.direction === 'inbound' ? last.from : last?.to;
        router.visit(`${route('mail.compose')}?to=${encodeURIComponent(replyTo ?? '')}&subject=${encodeURIComponent('Re: ' + subject)}`);
    };

    return (
        <AppFrame
            title={subject || 'Mail'}
            back={route('mail.threads')}
            actions={<button type="button" onClick={reply} className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60">Reply</button>}
        >
            <Head title={subject || 'Mail'} />

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}

            <div className="space-y-2">
                {mails.map((m) => (
                    <div key={m.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setOpenId((p) => p === m.id ? null : m.id)}
                            className="w-full text-left px-3 py-2.5 active:bg-white/10"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm text-white truncate">
                                    {m.direction === 'outbound' ? <span className="text-slate-400">To: </span> : null}
                                    {m.fromName ?? m.from}
                                </div>
                                <div className="text-[10px] text-slate-500 shrink-0">{m.sentAt ? new Date(m.sentAt).toLocaleString() : ''}</div>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                {m.from} → {m.to}
                                {m.cc && <span> · cc: {m.cc}</span>}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 capitalize">{m.status}</div>
                        </button>
                        {openId === m.id && (
                            <div className="px-3 py-3 border-t border-white/10">
                                {m.bodyHtml ? (
                                    <div className="prose prose-invert prose-sm max-w-none text-slate-200" dangerouslySetInnerHTML={{ __html: sanitize(m.bodyHtml) }} />
                                ) : (
                                    <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans">{m.bodyText ?? ''}</pre>
                                )}
                                {m.attachments.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Attachments</div>
                                        {m.attachments.map((a) => (
                                            <a
                                                key={a.id}
                                                href={`/api/mail/attachments/${a.id}`}
                                                download
                                                className="block text-xs text-sky-400 active:opacity-70 truncate"
                                            >
                                                📎 {a.name} <span className="text-slate-500">({(a.sizeBytes / 1024).toFixed(1)} KB)</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}

/** Crude sanitizer — strips script tags. Production should use HTMLPurifier on the backend. */
function sanitize(html: string): string {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '');
}
