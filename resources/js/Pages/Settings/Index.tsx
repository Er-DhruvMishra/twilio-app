import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { ReactNode } from 'react';

interface Row {
    href: string;
    label: string;
    description?: string;
    permission?: string;
    badge?: string;
    icon: ReactNode;
}

export default function SettingsIndex() {
    const { auth, twilio } = usePage<PageProps>().props;
    const has = (perm: string) => auth.user?.permissions?.includes(perm) ?? false;

    const sections: { title: string; rows: Row[] }[] = [
        {
            title: 'Account',
            rows: [
                {
                    href: route('profile.edit'),
                    label: 'Profile',
                    description: auth.user?.email ?? '',
                    icon: <Dot color="bg-slate-400" />,
                },
                {
                    href: route('settings.notifications'),
                    label: 'Notifications & Web Push',
                    description: 'Browser push for incoming calls',
                    icon: <Dot color="bg-amber-400" />,
                },
                {
                    href: route('settings.theme'),
                    label: 'Theme & display',
                    description: 'Light / dark / auto, high contrast',
                    icon: <Dot color="bg-indigo-400" />,
                },
            ],
        },
        {
            title: 'Telephony',
            rows: [
                {
                    href: route('settings.twilio'),
                    label: 'Twilio Account',
                    description: twilio?.configured ? `Connected: ${twilio.phoneNumber ?? 'no number'}` : 'Not connected',
                    badge: twilio?.configured ? undefined : 'Setup',
                    permission: 'manage-twilio',
                    icon: <Dot color={twilio?.configured ? 'bg-emerald-500' : 'bg-amber-500'} />,
                },
                {
                    href: route('settings.numbers'),
                    label: 'Phone Numbers',
                    description: 'Search and buy numbers',
                    permission: 'manage-twilio',
                    icon: <Dot color="bg-emerald-500" />,
                },
                {
                    href: route('settings.call'),
                    label: 'Call Settings',
                    description: 'Forwarding, recording, voicemail',
                    icon: <Dot color="bg-blue-500" />,
                },
                {
                    href: route('settings.blocklist'),
                    label: 'Blocklist',
                    description: 'Blacklist / whitelist numbers',
                    icon: <Dot color="bg-rose-500" />,
                },
            ],
        },
        {
            title: 'Messaging',
            rows: [
                {
                    href: route('settings.auto-reply'),
                    label: 'Auto-Reply Rules',
                    icon: <Dot color="bg-green-500" />,
                },
                {
                    href: route('settings.templates'),
                    label: 'SMS Templates',
                    icon: <Dot color="bg-green-500" />,
                },
            ],
        },
        {
            title: 'Automation',
            rows: [
                {
                    href: route('settings.ivr'),
                    label: 'IVR Builder',
                    description: 'Drag-and-drop call flows',
                    permission: 'manage-ivr',
                    icon: <Dot color="bg-violet-500" />,
                },
                {
                    href: route('settings.routing'),
                    label: 'Routing Rules',
                    description: 'Round-robin, skills, schedules',
                    permission: 'manage-routing',
                    icon: <Dot color="bg-indigo-500" />,
                },
            ],
        },
        {
            title: 'Communication',
            rows: [
                {
                    href: route('settings.fax-config'),
                    label: 'Fax (fax.plus)',
                    description: 'API token, sender number, webhook key',
                    permission: 'manage-twilio',
                    icon: <Dot color="bg-zinc-400" />,
                },
                {
                    href: route('settings.mail-config'),
                    label: 'Mail (SendGrid)',
                    description: 'API key, from-address, Inbound Parse host',
                    permission: 'manage-twilio',
                    icon: <Dot color="bg-sky-500" />,
                },
                {
                    href: route('settings.conversations-config'),
                    label: 'Conversations',
                    description: 'Service SID + per-channel binding',
                    permission: 'manage-twilio',
                    icon: <Dot color="bg-blue-500" />,
                },
                {
                    href: route('settings.debug'),
                    label: 'Debug logging',
                    description: 'Per-module API request/response trace',
                    permission: 'manage-twilio',
                    icon: <Dot color="bg-amber-400" />,
                },
            ],
        },
        {
            title: 'Billing',
            rows: [
                {
                    href: route('billing.index'),
                    label: 'Twilio Usage',
                    description: 'Balance and per-category spend',
                    permission: 'view-billing',
                    icon: <Dot color="bg-emerald-500" />,
                },
            ],
        },
        {
            title: 'Team',
            rows: [
                {
                    href: route('settings.team'),
                    label: 'Manage Team',
                    description: 'Invite agents, set roles',
                    permission: 'manage-team',
                    icon: <Dot color="bg-fuchsia-500" />,
                },
                {
                    href: route('settings.analytics'),
                    label: 'Analytics',
                    description: 'Calls, SMS, agents',
                    permission: 'view-analytics',
                    icon: <Dot color="bg-cyan-500" />,
                },
                {
                    href: route('settings.audit-log'),
                    label: 'Audit log',
                    description: 'Cross-user reads, role + permission changes',
                    permission: 'manage-team',
                    icon: <Dot color="bg-amber-300" />,
                },
            ],
        },
    ];

    return (
        <AppFrame title="Settings" back={route('home')}>
            <Head title="Settings" />
            <div className="space-y-5">
                {sections.map((s) => (
                    <div key={s.title}>
                        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-1.5">{s.title}</div>
                        <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10 overflow-hidden">
                            {s.rows
                                .filter((r) => !r.permission || has(r.permission))
                                .map((row) => (
                                    <Link
                                        key={row.href}
                                        href={row.href}
                                        className="flex items-center gap-3 px-4 py-3 active:bg-white/10"
                                    >
                                        {row.icon}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white">{row.label}</div>
                                            {row.description && (
                                                <div className="text-xs text-slate-400 truncate">{row.description}</div>
                                            )}
                                        </div>
                                        {row.badge && (
                                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                                                {row.badge}
                                            </span>
                                        )}
                                        <Chevron />
                                    </Link>
                                ))}
                        </div>
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}

const Dot = ({ color }: { color: string }) => (
    <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
);

const Chevron = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);
