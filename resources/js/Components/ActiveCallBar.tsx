import { useDeviceOptional } from '@/Components/TwilioDeviceProvider';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export default function ActiveCallBar() {
    const device = useDeviceOptional();
    const [elapsed, setElapsed] = useState(0);

    const active = device?.active;
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setElapsed(Math.floor((Date.now() - active.startedAt) / 1000)), 1000);
        return () => clearInterval(id);
    }, [active]);

    if (!active) return null;

    const onPhonePage = typeof window !== 'undefined' && window.location.pathname.startsWith('/phone');

    return (
        <button
            type="button"
            onClick={() => !onPhonePage && router.visit(route('phone.in-call'))}
            className={`flex items-center gap-2 px-4 py-2 bg-emerald-600/95 ${onPhonePage ? 'cursor-default' : 'cursor-pointer'} active:bg-emerald-700`}
            title={onPhonePage ? 'Active call' : 'Return to call'}
        >
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-semibold flex-1 text-left truncate">
                {active.from ?? active.to ?? 'In call'}
            </span>
            <span className="text-white text-xs tabular-nums">{formatDuration(elapsed)}</span>
            <span
                role="button"
                aria-label="End call"
                onClick={(e) => {
                    e.stopPropagation();
                    device?.hangUp();
                }}
                className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 active:bg-rose-600"
            >
                {/* Tilted handset = end-call. Rendered crisp at 12px. */}
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white" fill="currentColor" aria-hidden="true">
                    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85a.96.96 0 0 1-.65.26.97.97 0 0 1-.7-.29L.29 13.08a.99.99 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.46a.97.97 0 0 1-.7.29.96.96 0 0 1-.65-.25 11.6 11.6 0 0 0-2.67-1.85.99.99 0 0 1-.56-.9v-3.1A15.5 15.5 0 0 0 12 9z" transform="rotate(135 12 12)" />
                </svg>
            </span>
        </button>
    );
}

function formatDuration(s: number): string {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, '0')}`;
}
