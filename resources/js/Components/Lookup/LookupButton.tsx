import { useState } from 'react';
import axios from 'axios';

type Source = 'manual_search' | 'incoming_manual' | 'outgoing_manual';

interface Props {
    phone: string;
    source: Source;
    /** Compact icon-only button (default) vs labeled. */
    label?: string;
    onResult?: (result: LookupResult) => void;
    className?: string;
}

export interface LookupResult {
    id: number;
    callerName: string | null;
    callerType: string | null;
    lineType: string | null;
    carrierName: string | null;
}

export default function LookupButton({ phone, source, label, onResult, className }: Props) {
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<LookupResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        if (!phone || busy) return;
        setBusy(true); setError(null);
        try {
            const r = await axios.post('/api/lookups', { phone, source });
            const data = r.data.lookup as LookupResult;
            setResult(data);
            onResult?.(data);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Lookup failed');
        } finally {
            setBusy(false);
        }
    };

    if (result) {
        return (
            <span className="text-xs text-emerald-300 truncate" title={result.callerName ?? 'No name'}>
                {result.callerName ?? 'No name'}
                {result.lineType && <span className="text-slate-400 ml-1">· {result.lineType}</span>}
            </span>
        );
    }

    return (
        <button
            type="button"
            onClick={run}
            disabled={busy}
            title={error ?? 'Identify caller'}
            aria-label={label ?? 'Identify caller'}
            className={className ?? 'inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-500/15 text-blue-300 active:bg-blue-500/25 disabled:opacity-50'}
        >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
            </svg>
            {label && <span>{busy ? '⟳' : label}</span>}
        </button>
    );
}
