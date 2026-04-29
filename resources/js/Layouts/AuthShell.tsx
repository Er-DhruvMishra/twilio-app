import { ReactNode, useEffect } from 'react';
import BottomNav from '@/Components/BottomNav';
import { useOrientation } from '@/Hooks/useOrientation';

interface Props {
    children: ReactNode;
    title: string;
    subtitle?: string;
}

/**
 * Mobile-style shell for unauthenticated pages (login / register / invite /
 * forgot password). Same fixed frame and bottom nav as PhoneShell, minus the
 * StatusBar (no user yet). The Home button on these screens lands on /login —
 * the canonical entry point when there's no session.
 */
export default function AuthShell({ children, title, subtitle }: Props) {
    const { orientation, toggle, isLandscape } = useOrientation();

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const frameClass = isLandscape
        ? 'sm:w-[min(900px,90vw)] sm:h-[80vh] sm:rounded-[44px]'
        : 'sm:w-[420px] sm:h-[95vh] sm:rounded-[44px]';

    return (
        <div className="phone-shell-wrap fixed inset-0 bg-slate-900 flex items-center justify-center sm:p-4 overflow-hidden">
            <div
                className={`
                    phone-shell-frame relative w-full h-full
                    bg-gradient-to-b from-slate-950 to-slate-800
                    sm:shadow-2xl sm:border-[10px] sm:border-slate-950
                    overflow-hidden flex flex-col
                    ${frameClass}
                `}
            >
                <header className="px-6 pt-10 pb-4 text-center shrink-0">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor" aria-hidden="true">
                            <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.05-.24c1.12.39 2.33.6 3.54.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.21.21 2.42.6 3.54a1 1 0 0 1-.24 1.05l-2.24 2.2z" />
                        </svg>
                    </div>
                    <h1 className="text-white text-xl font-bold">{title}</h1>
                    {subtitle && <p className="text-slate-400 text-xs mt-1 leading-snug">{subtitle}</p>}
                </header>

                <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-6 pb-3">
                    {children}
                </main>

                <div className="shrink-0 px-6 pb-2 text-center text-[10px] text-slate-500">
                    Virtual Phone OS · Twilio-powered
                </div>

                <BottomNav
                    orientation={orientation}
                    onRotate={toggle}
                    homeHref="/login"
                    homeLabel="Sign in"
                />
            </div>
        </div>
    );
}
