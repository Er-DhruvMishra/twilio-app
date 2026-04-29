import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useWebPush } from '@/Hooks/useWebPush';

export default function Notifications() {
    const { status, error, busy, subscribe, unsubscribe, test, supported } = useWebPush();

    return (
        <AppFrame title="Notifications" back={route('settings.index')}>
            <Head title="Notifications" />

            <div className="space-y-3">
                {!supported && (
                    <div className="rounded-2xl bg-rose-500/10 border border-rose-400/30 p-4 text-rose-300 text-sm">
                        This browser doesn't support Web Push. iOS needs 16.4+ AND the site to be installed as a PWA from Safari's "Add to Home Screen".
                    </div>
                )}

                {status === 'denied' && (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-4 text-amber-200 text-sm">
                        Notifications were denied. Re-enable them in your browser's site settings (lock icon in the URL bar).
                    </div>
                )}

                <Card title="Browser push notifications">
                    <p className="text-slate-300 text-sm leading-relaxed">
                        Get OS-level notifications for incoming calls, SMS, and voicemail — even when this tab is in the background.
                    </p>
                    <div className="mt-3"><StatusPill status={status} /></div>
                    <div className="mt-4 flex gap-2 flex-wrap">
                        {status !== 'subscribed' ? (
                            <button
                                type="button"
                                disabled={busy || !supported || status === 'denied'}
                                onClick={subscribe}
                                className="bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                            >
                                {busy ? 'Subscribing…' : 'Enable notifications'}
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={test}
                                    className="bg-emerald-500 text-white rounded-xl px-4 py-2 text-sm font-semibold active:bg-emerald-600"
                                >
                                    Send a test push
                                </button>
                                <button
                                    type="button"
                                    onClick={unsubscribe}
                                    className="bg-white/5 border border-white/10 text-rose-300 rounded-xl px-4 py-2 text-sm font-semibold active:bg-white/10"
                                >
                                    Unsubscribe
                                </button>
                            </>
                        )}
                    </div>
                    {error && <div className="mt-3 text-rose-400 text-sm">{error}</div>}
                </Card>

                <Card title="Heads up">
                    <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed list-disc pl-4">
                        <li>Web Push needs HTTPS. In dev, point Twilio's webhooks at your ngrok URL via <span className="font-mono">php artisan dev:start</span>; the browser side keeps using localhost so Reverb wss stays happy.</li>
                        <li>iOS Safari only delivers push when the site is installed to the Home Screen as a PWA.</li>
                        <li>The service worker matches the page's origin — if you change ports/hosts you'll need to re-subscribe.</li>
                    </ul>
                </Card>
            </div>
        </AppFrame>
    );
}

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">{title}</div>
        {children}
    </div>
);

const StatusPill = ({ status }: { status: string }) => {
    const map: Record<string, { label: string; color: string }> = {
        unsupported: { label: 'Unsupported', color: 'bg-slate-500/20 text-slate-400' },
        denied: { label: 'Denied', color: 'bg-rose-500/20 text-rose-300' },
        unsubscribed: { label: 'Off', color: 'bg-slate-500/20 text-slate-300' },
        subscribed: { label: 'Subscribed', color: 'bg-emerald-500/20 text-emerald-300' },
    };
    const cfg = map[status] ?? map.unsubscribed;
    return (
        <span className={`inline-block text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.label}
        </span>
    );
};
