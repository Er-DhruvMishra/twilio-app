import { useEffect, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { usePresence, Presence } from '@/Hooks/usePresence';
import axios from 'axios';

/* eslint-disable @typescript-eslint/no-explicit-any */

type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | '5g';
type TwilioHealth = 'up' | 'down' | 'unknown' | 'unconfigured';

export default function StatusBar() {
    const { auth } = usePage<PageProps>().props;
    const [now, setNow] = useState(new Date());
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const presence = usePresence({
        authedUserId: auth.user?.id,
        initialPresence: (auth.user?.presence as Presence) ?? 'offline',
    });

    // Battery (one-shot on mount). null = browser doesn't expose the API.
    const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
    // Connectivity (one-shot on mount). null = browser doesn't expose the API.
    const [effectiveType, setEffectiveType] = useState<EffectiveType | null>(null);
    const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    // Twilio health (one-shot on mount).
    const [twilioHealth, setTwilioHealth] = useState<TwilioHealth>('unknown');
    const [twilioReason, setTwilioReason] = useState<string | null>(null);

    // Clock — refreshes every 30s. Not part of the once-on-mount data.
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(id);
    }, []);

    // Battery API — Chrome/Edge expose it, Firefox/Safari don't. We just
    // read once on mount per the user's spec; we don't subscribe to change
    // events even though the API offers them.
    useEffect(() => {
        const nav = navigator as any;
        if (typeof nav.getBattery !== 'function') return;
        nav.getBattery()
            .then((bm: any) => setBattery({ level: bm.level ?? 1, charging: !!bm.charging }))
            .catch(() => { /* not exposed in this context */ });
    }, []);

    // Network Information API — Chromium-based browsers expose
    // navigator.connection.effectiveType. Falls back to navigator.onLine.
    useEffect(() => {
        const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        const t = conn?.effectiveType as EffectiveType | undefined;
        if (t) setEffectiveType(t);
    }, []);

    // Twilio reachability ping (server-cached 60s).
    useEffect(() => {
        let cancelled = false;
        axios.get('/api/twilio/health')
            .then((r) => {
                if (cancelled) return;
                if (r.data.configured === false) {
                    setTwilioHealth('unconfigured');
                    setTwilioReason(r.data.reason ?? null);
                    return;
                }
                setTwilioHealth(r.data.up ? 'up' : 'down');
                setTwilioReason(r.data.reason ?? null);
            })
            .catch(() => { if (!cancelled) setTwilioHealth('down'); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const colorOf = (p: Presence) => ({
        available: 'bg-emerald-500',
        busy: 'bg-amber-500',
        away: 'bg-slate-400',
        offline: 'bg-slate-600',
    }[p]);

    const initials = (auth.user?.name ?? '').replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';

    const logout = () => {
        if (!confirm('Sign out?')) return;
        router.post('/logout');
    };

    return (
        <div className="relative shrink-0">
            <div className="flex items-center justify-between px-6 pt-3 pb-1 text-xs text-slate-200 select-none bg-black/40 backdrop-blur">
                <span className="font-semibold tabular-nums">{time}</span>
                <div className="flex items-center gap-2">
                    {auth.user && (
                        <button
                            type="button"
                            onClick={() => setOpen((s) => !s)}
                            className="flex items-center gap-1.5 px-1 py-0.5 rounded active:opacity-70"
                            aria-label="Profile menu"
                        >
                            <span className={`h-2 w-2 rounded-full ${colorOf(presence.me)}`} />
                            <span className="opacity-70 max-w-[80px] truncate">{auth.user.name}</span>
                        </button>
                    )}
                    {!auth.user && <span className="opacity-70">Guest</span>}
                    <TwilioDot health={twilioHealth} reason={twilioReason} />
                    <SignalIcon effectiveType={effectiveType} online={online} setOnline={setOnline} />
                    <BatteryIcon battery={battery} />
                </div>
            </div>

            {open && auth.user && (
                <div
                    ref={menuRef}
                    className="absolute right-3 top-full mt-1 z-40 rounded-xl bg-slate-800/95 border border-white/10 shadow-2xl py-1 min-w-[200px] text-white"
                >
                    <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-semibold">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm truncate">{auth.user.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{auth.user.email}</div>
                        </div>
                    </div>

                    <div className="py-1">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-1">Presence</div>
                        {(['available', 'busy', 'away', 'offline'] as Presence[]).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => { presence.set(p); setOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left active:bg-white/10"
                            >
                                <span className={`h-2 w-2 rounded-full ${colorOf(p)}`} />
                                <span className="capitalize flex-1">{p}</span>
                                {presence.me === p && <span className="text-emerald-300">✓</span>}
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-white/10 py-1">
                        <MenuItem label="Profile" onClick={() => { setOpen(false); router.visit(route('profile.edit')); }} />
                        <MenuItem label="Settings" onClick={() => { setOpen(false); router.visit(route('settings.index')); }} />
                        <MenuItem label="Theme & display" onClick={() => { setOpen(false); router.visit(route('settings.theme')); }} />
                        <MenuItem label="Sign out" danger onClick={logout} />
                    </div>
                </div>
            )}
        </div>
    );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left px-3 py-1.5 text-xs active:bg-white/10 ${danger ? 'text-rose-300' : ''}`}
        >
            {label}
        </button>
    );
}

/**
 * Signal bars driven by Network Information API. effectiveType maps to
 * 1..4 visible bars; offline draws all dim. Browsers that don't expose
 * the API show all bars (status unknown — same as the old static icon).
 */
function SignalIcon({
    effectiveType,
    online,
    setOnline,
}: {
    effectiveType: EffectiveType | null;
    online: boolean;
    setOnline: (v: boolean) => void;
}) {
    // Track online/offline transitions live since this is "current connectivity"
    // — losing wifi shouldn't require a page reload to reflect.
    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => {
            window.removeEventListener('online', up);
            window.removeEventListener('offline', down);
        };
    }, [setOnline]);

    const filled = !online ? 0
        : effectiveType === 'slow-2g' ? 1
            : effectiveType === '2g' ? 1
                : effectiveType === '3g' ? 2
                    : effectiveType === '4g' ? 3
                        : effectiveType === '5g' ? 4
                            : 4; // unknown → assume strong (matches previous default)

    const label = effectiveType ? effectiveType.toUpperCase() : (online ? 'NET' : 'OFFLINE');
    const dimColor = 'fill-slate-600';
    const liveColor = online ? 'fill-current' : 'fill-rose-400';

    return (
        <span className="inline-flex items-center gap-1" title={`Signal: ${label}`}>
            <span className="text-[8px] font-mono opacity-70 leading-none">{label}</span>
            <svg viewBox="0 0 16 12" className="h-3 w-4">
                <rect x="0" y="8" width="2" height="4" className={filled >= 1 ? liveColor : dimColor} />
                <rect x="4" y="6" width="2" height="6" className={filled >= 2 ? liveColor : dimColor} />
                <rect x="8" y="3" width="2" height="9" className={filled >= 3 ? liveColor : dimColor} />
                <rect x="12" y="0" width="2" height="12" className={filled >= 4 ? liveColor : dimColor} />
            </svg>
        </span>
    );
}

/**
 * Battery icon driven by the Battery Status API. Fill width tracks `level`,
 * a tiny lightning bolt overlay shows when charging. Browsers that don't
 * expose the API render full-fill (matches the previous static icon).
 */
function BatteryIcon({ battery }: { battery: { level: number; charging: boolean } | null }) {
    const pct = battery ? Math.max(0, Math.min(1, battery.level)) : 1;
    const fillWidth = Math.round(pct * 14); // bar inner width is 14
    const low = pct < 0.2;
    const fillClass = low && !battery?.charging ? 'fill-rose-400' : 'fill-current';
    const title = battery
        ? `${Math.round(pct * 100)}%${battery.charging ? ' · charging' : ''}`
        : 'Battery (unknown)';

    return (
        <span className="inline-flex items-center" title={title}>
            <svg viewBox="0 0 24 12" className="h-3 w-6">
                <rect x="0" y="0" width="22" height="12" rx="2" className="fill-none stroke-current" strokeWidth="1.5" />
                <rect x="22" y="3" width="2" height="6" rx="1" className="fill-current" />
                {fillWidth > 0 && (
                    <rect x="2" y="2" width={fillWidth} height="8" rx="1" className={fillClass} />
                )}
                {battery?.charging && (
                    // Tiny lightning bolt sitting over the fill.
                    <path d="M11 2 L7 7 H10 L9 10 L13 5 H10 Z" className="fill-amber-300" />
                )}
            </svg>
        </span>
    );
}

/**
 * Twilio reachability dot. Cloud icon with a small status pip:
 * up = green, down = red, unconfigured = slate, unknown = pulsing.
 */
function TwilioDot({ health, reason }: { health: TwilioHealth; reason: string | null }) {
    const pip = health === 'up' ? 'bg-emerald-400'
        : health === 'down' ? 'bg-rose-400'
            : health === 'unconfigured' ? 'bg-slate-400'
                : 'bg-slate-500 animate-pulse';
    const title = health === 'up' ? 'Twilio reachable'
        : health === 'down' ? `Twilio unreachable${reason ? ': ' + reason : ''}`
            : health === 'unconfigured' ? 'Twilio not configured'
                : 'Twilio · checking…';

    return (
        <span className="inline-flex items-center" title={title} aria-label={title}>
            <span className="relative inline-block">
                <svg viewBox="0 0 24 16" className="h-3 w-4 fill-current">
                    <path d="M19 7.5a4.5 4.5 0 0 0-8.74-1.36A3.5 3.5 0 0 0 5 9.5a3.5 3.5 0 0 0 3.5 3.5h10A3.5 3.5 0 0 0 22 9.5a3.5 3.5 0 0 0-3-3z" />
                </svg>
                <span className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-black/40 ${pip}`} />
            </span>
        </span>
    );
}
