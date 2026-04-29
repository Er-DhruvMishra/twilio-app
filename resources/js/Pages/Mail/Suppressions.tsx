import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Suppression {
    id: number;
    email: string;
    type: 'bounce' | 'spam' | 'unsubscribe' | 'invalid' | 'block';
    reason: string | null;
    suppressed_at: string;
}

const TYPES: Array<Suppression['type']> = ['bounce', 'spam', 'unsubscribe', 'invalid', 'block'];

export default function MailSuppressions() {
    const [items, setItems] = useState<Suppression[]>([]);
    const [type, setType] = useState<Suppression['type'] | 'all'>('all');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/mail/suppressions', { params: { type: type === 'all' ? undefined : type } });
            setItems(r.data.suppressions);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [type]);

    const remove = async (s: Suppression) => {
        if (!confirm(`Un-suppress ${s.email}?`)) return;
        await axios.delete(`/api/mail/suppressions/${encodeURIComponent(s.email)}`, { params: { type: s.type } });
        load();
    };

    return (
        <AppFrame title="Suppressions" back={route('mail.threads')}>
            <Head title="Suppressions" />

            <div className="flex gap-1 mb-3 flex-wrap">
                <Pill active={type === 'all'} onClick={() => setType('all')}>All</Pill>
                {TYPES.map((tt) => (
                    <Pill key={tt} active={type === tt} onClick={() => setType(tt)}>{tt}</Pill>
                ))}
            </div>

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && items.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">No suppressions.</div>
            )}

            <div className="divide-y divide-white/10">
                {items.map((s) => (
                    <div key={s.id} className="py-2 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{s.email}</div>
                            <div className="text-[10px] text-slate-400 truncate">
                                <span className="uppercase tracking-wide">{s.type}</span>
                                {s.reason && <> · {s.reason}</>}
                            </div>
                        </div>
                        <button type="button" onClick={() => remove(s)} className="text-rose-300 text-xs px-2 py-1 active:opacity-70">Remove</button>
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-xs px-3 py-1.5 rounded-full font-medium ${active ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}
        >
            {children}
        </button>
    );
}
