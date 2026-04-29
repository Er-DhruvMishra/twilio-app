import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';

interface Props {
    title: string;
    description?: string;
    back?: string;
    step?: string;
}

export default function PageStub({ title, description, back, step }: Props) {
    return (
        <AppFrame title={title} back={back}>
            <Head title={title} />
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-slate-300">
                <div className="text-base font-semibold text-white mb-1">{title}</div>
                <div className="text-sm leading-relaxed">
                    {description ?? 'This screen is part of the Virtual Phone OS build and will be filled in as we progress through the implementation plan.'}
                </div>
                {step && (
                    <div className="mt-3 text-xs text-slate-400 uppercase tracking-wide">Build step: {step}</div>
                )}
            </div>
        </AppFrame>
    );
}
