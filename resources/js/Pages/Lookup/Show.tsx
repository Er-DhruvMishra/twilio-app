import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface LookupDetail {
    id: number;
    phone: string;
    callerName: string | null;
    callerType: 'business' | 'consumer' | null;
    lineType: string | null;
    carrierName: string | null;
    countryCode: string | null;
    isValid: boolean;
    source: string;
    costCents: number;
    lookedUpAt: string;
    requester: { id: number; name: string } | null;
    payload: Record<string, unknown> | null;
}

export default function LookupShow({ lookupId }: { lookupId: number }) {
    const [row, setRow] = useState<LookupDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`/api/lookups/${lookupId}`).then((r) => setRow(r.data.lookup)).finally(() => setLoading(false));
    }, [lookupId]);

    return (
        <AppFrame title="Lookup detail" back={route('lookup.index')}>
            <Head title="Lookup detail" />

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && !row && <div className="text-slate-400 text-sm text-center py-6">Not found.</div>}

            {row && (
                <>
                    <Section title="Result">
                        <div className="text-base text-white font-semibold">
                            {row.callerName ?? (row.isValid ? 'No caller name available' : 'Invalid number')}
                        </div>
                        <div className="text-sm text-slate-300 font-mono mt-0.5">{row.phone}</div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 text-xs">
                            {row.callerType && <KV k="Type" v={row.callerType} />}
                            {row.lineType && <KV k="Line" v={row.lineType} />}
                            {row.carrierName && <KV k="Carrier" v={row.carrierName} />}
                            {row.countryCode && <KV k="Country" v={row.countryCode} />}
                            <KV k="Source" v={row.source.replace('_', ' · ')} />
                            <KV k="When" v={new Date(row.lookedUpAt).toLocaleString()} />
                            {row.costCents > 0 && <KV k="Cost" v={`$${(row.costCents / 100).toFixed(2)}`} />}
                            {row.requester && <KV k="Requested by" v={row.requester.name} />}
                        </div>
                    </Section>

                    {row.payload && (
                        <Section title="Raw payload">
                            <pre className="text-[10px] text-slate-300 font-mono overflow-x-auto whitespace-pre">
                                {JSON.stringify(row.payload, null, 2)}
                            </pre>
                        </Section>
                    )}
                </>
            )}
        </AppFrame>
    );
}

function KV({ k, v }: { k: string; v: string }) {
    return (
        <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500">{k}</div>
            <div className="text-slate-200 truncate">{v}</div>
        </div>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
    </section>
);
