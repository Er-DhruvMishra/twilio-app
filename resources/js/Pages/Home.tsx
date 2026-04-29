import PhoneShell from '@/Layouts/PhoneShell';
import AppIcon from '@/Components/AppIcon';
import { Head, usePage, router } from '@inertiajs/react';
import { PageProps } from '@/types';

export default function Home() {
    const { auth, badges, twilio } = usePage<PageProps>().props;
    const isAdmin = auth.user?.roles?.includes('admin') ?? false;
    const perms = auth.user?.permissions ?? [];
    const has = (p: string) => perms.includes(p);

    return (
        <PhoneShell>
            <Head title="Home" />

            <div className="px-6 pt-4 pb-2">
                <div className="text-slate-300 text-sm">Hello,</div>
                <div className="text-white text-2xl font-semibold">{auth.user?.name}</div>
                {twilio && !twilio.configured && (
                    <button
                        onClick={() => router.visit(route('settings.twilio'))}
                        className="mt-3 w-full text-left rounded-xl bg-amber-500/20 border border-amber-400/40 px-4 py-3"
                    >
                        <div className="text-amber-300 text-xs font-semibold uppercase tracking-wide">Setup needed</div>
                        <div className="text-white text-sm mt-0.5">Configure your Twilio account to make and receive calls</div>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-4 gap-y-6 gap-x-2 px-6 pt-6 pb-10">
                <AppIcon
                    href={route('phone.dialer')}
                    label="Phone"
                    color="from-emerald-500 to-emerald-700"
                    badge={badges?.missedCalls}
                    icon={<PhoneSvg />}
                />
                <AppIcon
                    href={route('messages.threads')}
                    label="Messages"
                    color="from-green-400 to-green-600"
                    badge={badges?.unreadMessages}
                    icon={<MessageSvg />}
                />
                <AppIcon
                    href={route('contacts.index')}
                    label="Contacts"
                    color="from-slate-500 to-slate-700"
                    icon={<ContactSvg />}
                />
                <AppIcon
                    href={route('voicemail.index')}
                    label="Voicemail"
                    color="from-rose-500 to-rose-700"
                    badge={badges?.unreadVoicemails}
                    icon={<VoicemailSvg />}
                />
                <AppIcon
                    href={route('phone.history')}
                    label="History"
                    color="from-indigo-500 to-indigo-700"
                    icon={<HistorySvg />}
                />
                <AppIcon
                    href={route('settings.index')}
                    label="Settings"
                    color="from-slate-600 to-slate-800"
                    icon={<GearSvg />}
                />
                {isAdmin && (
                    <AppIcon
                        href={route('settings.team')}
                        label="Team"
                        color="from-violet-500 to-violet-700"
                        icon={<TeamSvg />}
                    />
                )}
                {isAdmin && (
                    <AppIcon
                        href={route('settings.analytics')}
                        label="Analytics"
                        color="from-cyan-500 to-cyan-700"
                        icon={<ChartSvg />}
                    />
                )}
                {has('use-lookup') && (
                    <AppIcon
                        href={route('lookup.index')}
                        label="Lookup"
                        color="from-blue-500 to-blue-700"
                        icon={<LookupSvg />}
                    />
                )}
                {has('view-billing') && (
                    <AppIcon
                        href={route('billing.index')}
                        label="Billing"
                        color="from-emerald-600 to-emerald-800"
                        icon={<BillingSvg />}
                    />
                )}
                {has('view-fax') && (
                    <AppIcon
                        href={route('fax.index')}
                        label="Fax"
                        color="from-zinc-500 to-zinc-700"
                        badge={badges?.unreadFaxes}
                        icon={<FaxSvg />}
                    />
                )}
                {has('view-mail') && (
                    <AppIcon
                        href={route('mail.threads')}
                        label="Mail"
                        color="from-sky-500 to-sky-700"
                        badge={badges?.unreadMail}
                        icon={<MailSvg />}
                    />
                )}
                {has('use-chat') && (
                    <AppIcon
                        href={route('chat.threads')}
                        label="Chat"
                        color="from-blue-400 to-blue-600"
                        badge={badges?.unreadChat}
                        icon={<ChatSvg />}
                    />
                )}
                {has('use-rcs') && (
                    <AppIcon
                        href={route('rcs.threads')}
                        label="RCS"
                        color="from-amber-500 to-amber-700"
                        badge={badges?.unreadRcs}
                        icon={<MessageSvg />}
                    />
                )}
                {has('use-whatsapp') && (
                    <AppIcon
                        href={route('whatsapp.threads')}
                        label="WhatsApp"
                        color="from-emerald-500 to-emerald-700"
                        badge={badges?.unreadWhatsapp}
                        icon={<WhatsappSvg />}
                    />
                )}
                {has('use-facebook') && (
                    <AppIcon
                        href={route('facebook.threads')}
                        label="Messenger"
                        color="from-blue-600 to-blue-800"
                        badge={badges?.unreadFacebook}
                        icon={<MessengerSvg />}
                    />
                )}
                {has('use-video') && (
                    <AppIcon
                        href={route('video.index')}
                        label="Video"
                        color="from-pink-500 to-pink-700"
                        icon={<VideoSvg />}
                    />
                )}
                <AppIcon
                    href={route('diagnostics')}
                    label="Diagnostics"
                    color="from-amber-500 to-amber-700"
                    icon={<DiagSvg />}
                />
            </div>
        </PhoneShell>
    );
}

const Svg = ({ d }: { d: string }) => (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

const PhoneSvg = () => <Svg d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />;
const MessageSvg = () => <Svg d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
const ContactSvg = () => <Svg d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />;
const VoicemailSvg = () => <Svg d="M5.5 16a4.5 4.5 0 1 1 4.5-4.5A4.5 4.5 0 0 1 5.5 16zm13 0a4.5 4.5 0 1 1 4.5-4.5 4.5 4.5 0 0 1-4.5 4.5zM5.5 16h13" />;
const HistorySvg = () => <Svg d="M3 3v6h6 M3.51 15a9 9 0 1 0 2.13-9.36L3 8 M12 7v5l4 2" />;
const GearSvg = () => <Svg d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />;
const TeamSvg = () => <Svg d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />;
const ChartSvg = () => <Svg d="M18 20V10 M12 20V4 M6 20v-6" />;
const LookupSvg = () => <Svg d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14z M21 21l-4.35-4.35" />;
const BillingSvg = () => <Svg d="M3 7h18 M3 12h18 M3 17h18 M6 7v10 M18 7v10" />;
const FaxSvg = () => <Svg d="M19 9h-1V4H6v5H5a2 2 0 0 0-2 2v5h4v4h10v-4h4v-5a2 2 0 0 0-2-2z M8 6h8v3H8V6z M8 19v-4h8v4H8z" />;
const MailSvg = () => <Svg d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6" />;
const ChatSvg = () => <Svg d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />;
// WhatsApp brand mark — chat bubble with a tail at the bottom-left and a
// handset cut out of the middle. Uses the canonical 24-unit path with
// `evenodd` fill so the inner handset reads as a hole, not a solid fill.
const WhatsappSvg = () => (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor" fillRule="evenodd" clipRule="evenodd" aria-hidden="true">
        <path d="M20.463 3.488A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892a11.86 11.86 0 0 0 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413M12.05 21.785h-.004a9.87 9.87 0 0 1-5.03-1.378l-.361-.214-3.74.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.435-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m5.422-7.403c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.875 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
    </svg>
);

// Messenger: lightning-bolt-in-bubble silhouette.
const MessengerSvg = () => (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.13 7.18.16.15.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.99-.88a.9.9 0 0 1 .6-.04c.91.25 1.87.39 2.84.39 5.64 0 10-4.13 10-9.71S17.64 2 12 2zm6 7.71-2.94 4.66c-.47.74-1.47.92-2.16.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.62l2.94-4.66c.47-.74 1.47-.92 2.16-.4l2.34 1.75c.21.16.51.16.72 0l3.16-2.4c.42-.32.97.18.69.62z" />
    </svg>
);
const VideoSvg = () => <Svg d="M23 7l-7 5 7 5V7z M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />;
const DiagSvg = () => <Svg d="M9 12l2 2 4-4 M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />;
