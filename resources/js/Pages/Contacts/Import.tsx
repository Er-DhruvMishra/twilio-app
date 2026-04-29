import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useState, ChangeEvent } from 'react';
import axios from 'axios';

export default function ContactsImport() {
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ created: number; skipped: number; rows: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const onPick = (e: ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files?.[0] ?? null);
        setResult(null);
        setError(null);
    };

    const upload = async () => {
        if (!file) return;
        setBusy(true); setError(null); setResult(null);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const r = await axios.post('/api/contacts/import', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult({
                created: r.data.created,
                skipped: r.data.skipped,
                rows: r.data.rows,
            });
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Import failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppFrame title="Import Contacts" back={route('contacts.index')}>
            <Head title="Import Contacts" />

            <div className="space-y-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-slate-300 leading-relaxed">
                    Upload a CSV with at least <span className="font-mono">name</span> and <span className="font-mono">phone</span> columns.
                    Optional: <span className="font-mono">email</span>. Numbers are normalized (libphonenumber) and de-duplicated against existing contacts.
                </div>

                <label className="block">
                    <div className="text-xs text-slate-300 mb-1.5">CSV file</div>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={onPick}
                        className="w-full text-sm text-slate-200 file:bg-blue-500 file:text-white file:rounded-lg file:px-3 file:py-1.5 file:border-0 file:text-xs file:font-semibold"
                    />
                </label>

                {file && (
                    <div className="text-xs text-slate-400">
                        <span className="font-mono">{file.name}</span> · {Math.round(file.size / 1024)} KB
                    </div>
                )}

                {error && <div className="text-rose-400 text-sm">{error}</div>}
                {result && (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-3 text-emerald-200 text-sm">
                        Imported <strong>{result.created}</strong> new contacts ({result.skipped} duplicates skipped of {result.rows} rows).
                    </div>
                )}

                <button
                    type="button"
                    onClick={upload}
                    disabled={!file || busy}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {busy ? 'Importing…' : 'Upload & import'}
                </button>

                {result && result.created > 0 && (
                    <button
                        type="button"
                        onClick={() => router.visit(route('contacts.index'))}
                        className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 text-sm font-semibold active:bg-white/10"
                    >
                        Back to contacts
                    </button>
                )}
            </div>
        </AppFrame>
    );
}
