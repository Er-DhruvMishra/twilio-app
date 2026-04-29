import { ReactNode } from 'react';
import { router } from '@inertiajs/react';
import type { Orientation } from '@/Hooks/useOrientation';

interface Props {
    orientation: Orientation;
    onRotate: () => void;
    /** Where the Home button should land. Defaults to authed `/home`; auth screens pass `/login`. */
    homeHref?: string;
    /** Tooltip for the Home button. */
    homeLabel?: string;
}

export default function BottomNav({ orientation, onRotate, homeHref = '/home', homeLabel = 'Home' }: Props) {
    return (
        <nav className="shrink-0 grid grid-cols-3 items-center px-3 py-2 border-t border-white/10 bg-black/40 backdrop-blur">
            <NavBtn label="Back" onClick={() => window.history.back()}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                    <path d="M15 6.5l-1.5-1.5L7 11.5 13.5 18l1.5-1.5-5-5z" />
                </svg>
            </NavBtn>
            <NavBtn label={homeLabel} onClick={() => router.visit(homeHref)}>
                <span className="block w-7 h-7 rounded-full border-2 border-current" />
            </NavBtn>
            <NavBtn label={orientation === 'portrait' ? 'Rotate to landscape' : 'Rotate to portrait'} onClick={onRotate}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                    <path d="M16.48 2.52c3.27 1.55 5.61 4.72 5.97 8.48h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32zm-6.25-.77c-.59-.59-1.54-.59-2.12 0L1.75 8.11c-.59.59-.59 1.54 0 2.12l12.02 12.02c.59.59 1.54.59 2.12 0l6.36-6.36c.59-.59.59-1.54 0-2.12L10.23 1.75zm4.6 19.44L2.81 9.17l6.36-6.36 12.02 12.02-6.36 6.36zm-7.31.29C4.25 19.94 1.91 16.76 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32z" />
                </svg>
            </NavBtn>
        </nav>
    );
}

function NavBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="flex items-center justify-center h-9 mx-auto px-4 text-slate-300 active:text-white active:bg-white/10 rounded-full"
        >
            {children}
        </button>
    );
}
