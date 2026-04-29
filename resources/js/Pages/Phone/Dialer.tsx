import AppFrame from '@/Layouts/AppFrame';
import { Head, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useDevice } from '@/Components/TwilioDeviceProvider';
import { useEffect, useRef, useState } from 'react';
import { useLongPress } from '@/Hooks/useLongPress';
import LookupButton, { LookupResult } from '@/Components/Lookup/LookupButton';
import axios from 'axios';

const KEYS: Array<{ d: string; sub?: string }> = [
    { d: '1' }, { d: '2', sub: 'ABC' }, { d: '3', sub: 'DEF' },
    { d: '4', sub: 'GHI' }, { d: '5', sub: 'JKL' }, { d: '6', sub: 'MNO' },
    { d: '7', sub: 'PQRS' }, { d: '8', sub: 'TUV' }, { d: '9', sub: 'WXYZ' },
    { d: '*' }, { d: '0', sub: '+' }, { d: '#' },
];

interface Suggestion { id: number; name: string; phone: string }

export default function Dialer() {
    const { twilio, auth } = usePage<PageProps>().props;
    const canLookup = (auth.user?.permissions ?? []).includes('use-lookup');
    const device = useDevice();
    const [number, setNumber] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [lookupHint, setLookupHint] = useState<LookupResult | null>(null);
    const [lastDialed, setLastDialed] = useState<string | null>(null);
    const [speedDial, setSpeedDial] = useState<Record<string, string>>({});
    const [speedDialFlash, setSpeedDialFlash] = useState<string | null>(null);
    const lastQueryRef = useRef('');

    // Pre-fetch last-dialed + speed-dial map on mount. Both are tiny.
    useEffect(() => {
        axios.get('/api/calls/last-outbound').then((r) => setLastDialed(r.data.phone ?? null)).catch(() => {});
        axios.get('/api/settings/call').then((r) => setSpeedDial(r.data.settings?.speedDialSlots ?? {})).catch(() => {});
    }, []);

    // Live T9 / contact suggestions while typing.
    useEffect(() => {
        if (device.active || number.length < 2) {
            setSuggestions([]);
            return;
        }
        const q = number;
        lastQueryRef.current = q;
        const timer = setTimeout(async () => {
            try {
                const r = await axios.get('/api/contacts/suggest', { params: { q } });
                if (lastQueryRef.current === q) setSuggestions(r.data.suggestions);
            } catch { /* ignore */ }
        }, 150);
        return () => clearTimeout(timer);
    }, [number, device.active]);

    const press = (digit: string) => {
        if (device.active) {
            // DTMF — also echo it locally so the user sees what they sent.
            device.sendDigits(digit);
            setNumber((n) => n + digit);
            return;
        }
        setNumber((n) => (n + digit).slice(0, 25));
    };

    const longPressZero = () => {
        if (device.active) return;
        // Replace the trailing '0' that the press fired with '+'.
        setNumber((n) => (n.endsWith('0') ? n.slice(0, -1) + '+' : n + '+'));
    };

    /**
     * Long-press on digits 1-9: dial the speed-dial slot bound to that digit.
     * If the slot is empty, no-op (and a brief toast tells the user).
     * If a digit was just inserted by the same press, peel it off first so
     * we don't end up with a stray "1" in the buffer after dialing.
     */
    const longPressDigit = (digit: string) => {
        if (device.active) return;
        const target = speedDial[digit];
        // Always peel the trailing digit that the click already inserted.
        setNumber((n) => (n.endsWith(digit) ? n.slice(0, -1) : n));
        if (!target) {
            setSpeedDialFlash(`No speed dial set for ${digit}`);
            setTimeout(() => setSpeedDialFlash(null), 1500);
            return;
        }
        dial(target);
    };

    const backspace = () => setNumber((n) => n.slice(0, -1));

    const dial = async (target?: string) => {
        const to = toE164(target ?? number);
        if (!to) return;
        // Pre-dial auto-lookup: backend decides whether to fire based on
        // the user's `auto_lookup_outbound` toggle and contact existence.
        if (canLookup) {
            try {
                const r = await axios.post('/api/lookups/pre-dial', { phone: to });
                if (r.data.lookup) setLookupHint(r.data.lookup);
            } catch { /* non-fatal — proceed with dial */ }
        }
        try {
            await device.dial(to);
        } catch (e: unknown) {
            console.error(e);
        }
    };

    /**
     * Green-button behavior:
     *   - empty buffer + we have a last-dialed → recall it into the buffer
     *     (don't auto-dial; user taps again to actually call).
     *   - buffer has digits → dial.
     */
    const onCall = () => {
        if (!number && lastDialed) {
            setNumber(lastDialed);
            return;
        }
        dial();
    };

    // Reset stale lookup hint when user starts editing again.
    useEffect(() => { setLookupHint(null); }, [number]);

    const e164 = toE164(number);

    if (!twilio?.configured || !twilio?.phoneNumber) {
        return (
            <AppFrame title="Phone" back={route('home')}>
                <Head title="Phone" />
                <div className="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-4 text-amber-200 text-sm">
                    {!twilio?.configured ? 'Connect your Twilio account first.' : 'Pick an active phone number first.'}
                </div>
                <button
                    type="button"
                    onClick={() => router.visit(route('settings.twilio'))}
                    className="mt-3 w-full bg-blue-500 text-white rounded-xl py-3 font-semibold active:bg-blue-600"
                >
                    Open Twilio settings
                </button>
            </AppFrame>
        );
    }

    return (
        <AppFrame title="Phone" back={route('home')}>
            <Head title="Phone" />

            <div className="flex flex-col h-full">
                <div className="text-center pt-2 pb-1 px-2">
                    <div className="font-mono text-2xl font-light text-white tracking-wide tabular-nums min-h-[36px] break-all">
                        {number || (
                            lastDialed
                                ? <span className="text-slate-500 text-sm">Tap <CallGlyph className="inline-block w-3.5 h-3.5 align-middle text-emerald-400" /> for last: <span className="font-mono text-slate-400">{lastDialed}</span></span>
                                : <span className="text-slate-500 text-sm">Enter a number</span>
                        )}
                    </div>
                    {number && e164 !== number && (
                        <div className="text-slate-400 text-[11px] mt-0.5 font-mono">{e164}</div>
                    )}
                    {canLookup && e164 && !device.active && (
                        <div className="mt-1 flex items-center justify-center gap-2">
                            {lookupHint?.callerName ? (
                                <span className="text-xs text-emerald-300 truncate">
                                    {lookupHint.callerName}
                                    {lookupHint.lineType && <span className="text-slate-400 ml-1">· {lookupHint.lineType}</span>}
                                </span>
                            ) : (
                                <LookupButton
                                    phone={e164}
                                    source="outgoing_manual"
                                    label="Identify"
                                    onResult={(r) => setLookupHint(r)}
                                />
                            )}
                        </div>
                    )}
                    <DeviceStatusPill status={device.status} error={device.error} />
                    {speedDialFlash && (
                        <div className="text-[10px] text-amber-300 mt-1">{speedDialFlash}</div>
                    )}
                </div>

                {!device.active && suggestions.length > 0 && (
                    <div className="mx-2 mb-1 rounded-xl bg-white/5 border border-white/10 divide-y divide-white/10 max-h-28 overflow-y-auto no-scrollbar">
                        {suggestions.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => dial(s.phone)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left active:bg-white/10"
                            >
                                <span className="text-white text-sm truncate flex-1">{s.name}</span>
                                <span className="text-[11px] text-slate-400 font-mono shrink-0">{s.phone}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2 mt-1 px-3 w-full">
                    {KEYS.map((k) => {
                        const isDigit = /^[1-9]$/.test(k.d);
                        const slot = isDigit ? speedDial[k.d] : undefined;
                        return (
                            <DialKey
                                key={k.d}
                                k={k}
                                speedDialTarget={slot ?? null}
                                onPress={() => press(k.d)}
                                onLongPress={
                                    k.d === '0'
                                        ? longPressZero
                                        : isDigit
                                            ? () => longPressDigit(k.d)
                                            : undefined
                                }
                            />
                        );
                    })}
                </div>

                <div className="grid grid-cols-3 gap-3 px-3 w-full mt-3 mb-3 items-center">
                    <div />
                    <button
                        type="button"
                        onClick={onCall}
                        disabled={(!number && !lastDialed) || device.status !== 'ready'}
                        aria-label={!number && lastDialed ? 'Recall last dialed' : 'Call'}
                        title={!number && lastDialed ? `Tap to recall ${lastDialed}` : 'Call'}
                        className="aspect-square rounded-full bg-emerald-500 active:bg-emerald-600 disabled:opacity-40 flex items-center justify-center shadow-lg shadow-emerald-500/30"
                    >
                        <CallGlyph className="w-7 h-7 text-white" />
                    </button>
                    <button
                        type="button"
                        onClick={backspace}
                        disabled={!number}
                        aria-label="Backspace"
                        title="Backspace"
                        className="aspect-square rounded-full bg-transparent active:bg-white/10 disabled:opacity-30 flex items-center justify-center"
                    >
                        <BackspaceIcon />
                    </button>
                </div>
            </div>
        </AppFrame>
    );
}

function DialKey({ k, onPress, onLongPress, speedDialTarget }: {
    k: { d: string; sub?: string };
    onPress: () => void;
    onLongPress?: () => void;
    speedDialTarget?: string | null;
}) {
    const longPress = useLongPress({
        onLongPress: () => onLongPress?.(),
        onClick: onPress,
        delayMs: 450,
    });

    if (onLongPress) {
        const ariaLabel = k.d === '0'
            ? `${k.d} (hold for +)`
            : speedDialTarget
                ? `${k.d} (hold to dial speed-dial ${speedDialTarget})`
                : `${k.d}`;
        return (
            <button
                type="button"
                {...longPress}
                aria-label={ariaLabel}
                title={speedDialTarget ? `Hold to dial ${speedDialTarget}` : undefined}
                className="aspect-square rounded-full bg-white/10 hover:bg-white/15 active:bg-white/25 flex flex-col items-center justify-center select-none relative"
            >
                <span className="text-white text-[26px] leading-none font-light">{k.d}</span>
                {k.sub && <span className="text-slate-400 text-[10px] tracking-widest mt-0.5">{k.sub}</span>}
                {speedDialTarget && (
                    <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400" title={speedDialTarget} />
                )}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onPress}
            aria-label={k.d}
            className="aspect-square rounded-full bg-white/10 hover:bg-white/15 active:bg-white/25 flex flex-col items-center justify-center select-none"
        >
            <span className="text-white text-[26px] leading-none font-light">{k.d}</span>
            {k.sub && <span className="text-slate-400 text-[10px] tracking-widest mt-0.5">{k.sub}</span>}
        </button>
    );
}

function DeviceStatusPill({ status, error }: { status: string; error: string | null }) {
    const map: Record<string, { label: string; color: string }> = {
        idle: { label: 'idle', color: 'bg-slate-500/20 text-slate-300' },
        connecting: { label: 'connecting…', color: 'bg-amber-500/20 text-amber-300' },
        registering: { label: 'registering…', color: 'bg-amber-500/20 text-amber-300' },
        ready: { label: 'ready', color: 'bg-emerald-500/20 text-emerald-300' },
        busy: { label: 'in call', color: 'bg-blue-500/20 text-blue-300' },
        error: { label: error ?? 'error', color: 'bg-rose-500/20 text-rose-300' },
    };
    const cfg = map[status] ?? map.idle;
    return (
        <div className={`inline-block mt-1.5 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.label}
        </div>
    );
}

const CallGlyph = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.05-.24c1.12.39 2.33.6 3.54.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.21.21 2.42.6 3.54a1 1 0 0 1-.24 1.05l-2.24 2.2z" />
    </svg>
);

const BackspaceIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M18 9l-6 6 M12 9l6 6" />
    </svg>
);

function toE164(input: string): string {
    let s = input.trim();
    if (s.startsWith('+')) return '+' + s.slice(1).replace(/[^0-9]/g, '');
    s = s.replace(/[^0-9]/g, '');
    if (!s) return '';
    return '+' + s;
}
