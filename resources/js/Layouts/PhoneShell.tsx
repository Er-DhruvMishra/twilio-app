import { ReactNode, useEffect } from 'react';
import StatusBar from '@/Components/StatusBar';
import IncomingCallSheet from '@/Components/IncomingCallSheet';
import ActiveCallBar from '@/Components/ActiveCallBar';
import BottomNav from '@/Components/BottomNav';
import { useOrientation } from '@/Hooks/useOrientation';

interface Props {
    children: ReactNode;
    title?: string;
}

export default function PhoneShell({ children }: Props) {
    const { orientation, toggle, isLandscape } = useOrientation();

    // Lock body so ONLY the inner main scrolls.
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    // Frame dimensions: always-max so the shell looks the same on every page.
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
                <StatusBar />
                <ActiveCallBar />
                <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
                    {children}
                </main>
                <BottomNav orientation={orientation} onRotate={toggle} />
                <IncomingCallSheet />
            </div>
        </div>
    );
}
