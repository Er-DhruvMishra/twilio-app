import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface FaxDetail {
    id: number;
    direction: 'inbound' | 'outbound';
    from: string | null;
    to: string | null;
    numPages: number;
    status: string;
    errorMessage: string | null;
    isRead: boolean;
    costCents: number;
    startedAt: string | null;
    endedAt: string | null;
    contact: { id: number; name: string } | null;
    owner: { id: number; name: string } | null;
    documents: Array<{ id: number; originalName: string; pages: number; sizeBytes: number }> | null;
}

export default function FaxShow({ faxId }: { faxId: number }) {
    const [fax, setFax] = useState<FaxDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`/api/faxes/${faxId}`).then((r) => setFax(r.data.fax)).finally(() => setLoading(false));
    }, [faxId]);

    const remove = async () => {
        if (!confirm('Delete this fax?')) return;
        await axios.delete(`/api/faxes/${faxId}`);
        router.visit(route('fax.index'));
    };

    return (
        <AppFrame title="Fax" back={route('fax.index')}>
            <Head title="Fax" />

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && !fax && <div className="text-slate-400 text-sm text-center py-6">Not found.</div>}

            {fax && (
                <>
                    <Section title="Details">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                            <KV k="Direction" v={fax.direction} />
                            <KV k="Status" v={fax.status.replace('_', ' ')} />
                            <KV k="From" v={fax.from ?? '—'} mono />
                            <KV k="To" v={fax.to ?? '—'} mono />
                            <KV k="Pages" v={String(fax.numPages)} />
                            {fax.costCents > 0 && <KV k="Cost" v={`$${(fax.costCents / 100).toFixed(2)}`} />}
                            {fax.startedAt && <KV k="Started" v={new Date(fax.startedAt).toLocaleString()} />}
                            {fax.endedAt && <KV k="Ended" v={new Date(fax.endedAt).toLocaleString()} />}
                        </div>
                        {fax.errorMessage && (
                            <div className="mt-2 rounded-lg bg-rose-500/10 border border-rose-400/30 p-2 text-rose-300 text-xs">{fax.errorMessage}</div>
                        )}
                    </Section>

                    {fax.status === 'success' && (
                        <Section title="Document">
                            <embed
                                src={`/api/faxes/${fax.id}/pdf`}
                                type="application/pdf"
                                className="w-full rounded-lg"
                                style={{ minHeight: '400px' }}
                            />
                            <a
                                href={`/api/faxes/${fax.id}/pdf`}
                                download
                                className="mt-2 inline-block text-xs text-sky-400 active:opacity-70"
                            >
                                Download PDF
                            </a>
                        </Section>
                    )}

                    <button
                        type="button"
                        onClick={remove}
                        className="text-rose-300 text-xs px-3 py-2 active:opacity-70"
                    >
                        Delete fax
                    </button>
                </>
            )}
        </AppFrame>
    );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
    return (
        <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500">{k}</div>
            <div className={`text-slate-200 truncate ${mono ? 'font-mono' : ''}`}>{v}</div>
        </div>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
    </section>
);
