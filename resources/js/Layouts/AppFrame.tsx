import { ReactNode } from 'react';
import { router } from '@inertiajs/react';
import PhoneShell from './PhoneShell';

interface Props {
    children: ReactNode;
    title: string;
    back?: string | (() => void);
    actions?: ReactNode;
}

export default function AppFrame({ children, title, back, actions }: Props) {
    const handleBack = () => {
        if (typeof back === 'function') back();
        else if (typeof back === 'string') router.visit(back);
        else window.history.back();
    };

    return (
        <PhoneShell>
            <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
                <button
                    onClick={handleBack}
                    className="text-sky-400 text-sm flex items-center gap-1 px-2 py-1 active:opacity-60"
                >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span>Back</span>
                </button>
                <h1 className="text-white text-base font-semibold">{title}</h1>
                <div className="min-w-[60px] flex justify-end">{actions}</div>
            </div>
            <div className="px-4 py-4 text-slate-100">{children}</div>
        </PhoneShell>
    );
}
