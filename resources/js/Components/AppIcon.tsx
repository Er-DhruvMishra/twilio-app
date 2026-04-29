import { Link } from '@inertiajs/react';
import { ReactNode } from 'react';

interface Props {
    href: string;
    label: string;
    icon: ReactNode;
    badge?: number;
    color?: string;
}

export default function AppIcon({ href, label, icon, badge, color = 'from-blue-500 to-blue-700' }: Props) {
    return (
        <Link
            href={href}
            className="flex flex-col items-center gap-1.5 group focus:outline-none"
        >
            <div className="relative">
                <div
                    className={`
                        w-16 h-16 rounded-[18px] bg-gradient-to-br ${color}
                        flex items-center justify-center text-white
                        shadow-lg shadow-black/30
                        transition-transform duration-100
                        group-active:scale-95
                    `}
                >
                    {icon}
                </div>
                {badge !== undefined && badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center px-1.5 ring-2 ring-slate-900">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </div>
            <span className="text-[11px] text-slate-100 font-medium drop-shadow">{label}</span>
        </Link>
    );
}
