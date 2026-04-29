import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';

export default function MailCompose() {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const [to, setTo] = useState(params.get('to') ?? '');
    const [cc, setCc] = useState('');
    const [subject, setSubject] = useState(params.get('subject') ?? '');
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const TOTAL_BYTE_CAP = 28 * 1024 * 1024;
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    const overCap = totalBytes > TOTAL_BYTE_CAP;

    const addFiles = (list: FileList | null) => {
        if (!list) return;
        const incoming = Array.from(list);
        // Cap at 10 files per send (matches server validation).
        setFiles((prev) => [...prev, ...incoming].slice(0, 10));
    };

    const removeFile = (idx: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const send = async () => {
        if (!to.trim() || !subject.trim() || overCap) return;
        setBusy(true); setError(null);
        try {
            const fd = new FormData();
            fd.append('to', to.trim());
            if (cc.trim()) fd.append('cc', cc.trim());
            fd.append('subject', subject.trim());
            fd.append('body_html', body.replace(/\n/g, '<br>'));
            fd.append('body_text', body);
            files.forEach((f) => fd.append('attachments[]', f, f.name));
            await axios.post('/api/mail', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            router.visit(route('mail.threads'));
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            const msg = err.response?.data?.errors
                ? Object.values(err.response.data.errors).flat().join(' ')
                : err.response?.data?.message;
            setError(msg ?? 'Failed to send');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppFrame title="New mail" back={route('mail.threads')}>
            <Head title="New mail" />

            <div className="space-y-3">
                <Field label="To" type="email" value={to} onChange={setTo} placeholder="recipient@example.com" />
                <Field label="Cc" value={cc} onChange={setCc} placeholder="optional, comma-separated" />
                <Field label="Subject" value={subject} onChange={setSubject} />
                <label className="block">
                    <div className="text-xs text-slate-300 mb-1">Body</div>
                    <textarea
                        rows={10}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                    />
                </label>

                <label className="block">
                    <div className="text-xs text-slate-300 mb-1 flex items-center justify-between">
                        <span>Attachments</span>
                        {files.length > 0 && (
                            <span className={`text-[10px] ${overCap ? 'text-rose-400' : 'text-slate-400'}`}>
                                {(totalBytes / 1024 / 1024).toFixed(1)} / 28 MB · {files.length}/10 files
                            </span>
                        )}
                    </div>
                    <input
                        type="file"
                        multiple
                        onChange={(e) => addFiles(e.target.files)}
                        className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500/20 file:text-blue-300 file:text-xs file:font-semibold"
                    />
                    {files.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {files.map((f, i) => (
                                <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs bg-white/5 rounded-lg px-2 py-1.5">
                                    <span className="flex-1 truncate text-slate-200">📎 {f.name}</span>
                                    <span className="text-[10px] text-slate-500 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(i)}
                                        className="text-rose-300 active:opacity-70 shrink-0 px-1"
                                        aria-label="Remove"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {overCap && (
                        <div className="text-rose-400 text-[10px] mt-1">Total exceeds SendGrid's 28 MB combined limit.</div>
                    )}
                </label>

                {error && <div className="text-rose-400 text-sm">{error}</div>}

                <button
                    type="button"
                    onClick={send}
                    disabled={busy || !to.trim() || !subject.trim() || overCap}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {busy ? 'Sending…' : files.length > 0 ? `Send · ${files.length} attachment${files.length > 1 ? 's' : ''}` : 'Send'}
                </button>
            </div>
        </AppFrame>
    );
}

function Field({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
    return (
        <label className="block">
            <div className="text-xs text-slate-300 mb-1">{label}</div>
            <input
                type={type ?? 'text'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
            />
        </label>
    );
}
