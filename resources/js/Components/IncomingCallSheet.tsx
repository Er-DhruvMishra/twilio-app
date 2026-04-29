import { useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useDeviceOptional } from '@/Components/TwilioDeviceProvider';
import LookupButton, { LookupResult } from '@/Components/Lookup/LookupButton';
import { usePrivateChannel } from '@/Hooks/useEcho';

interface LookupCompletedPayload {
    id: number;
    phone: string;
    callerName: string | null;
    callerType: string | null;
    lineType: string | null;
    carrierName: string | null;
    isValid: boolean;
    source: string;
}

export default function IncomingCallSheet() {
    const device = useDeviceOptional();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const { auth } = usePage<PageProps>().props;
    const canLookup = (auth.user?.permissions ?? []).includes('use-lookup');

    const incoming = device?.incoming;
    const [lookupHit, setLookupHit] = useState<LookupCompletedPayload | null>(null);

    // Reset stale lookup hint when a new call arrives.
    useEffect(() => { setLookupHit(null); }, [incoming?.from]);

    // Auto-inbound lookup result lands here without the user clicking anything.
    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.LookupCompleted': (e) => {
            const p = e as LookupCompletedPayload | undefined;
            if (!p || !incoming?.from) return;
            if (p.phone === incoming.from && p.callerName) {
                setLookupHit(p);
            }
        },
    });

    useEffect(() => {
        if (!incoming) return;
        const audio = audioRef.current;
        if (!audio) return;
        audio.loop = true;
        audio.volume = 0.7;
        audio.play().catch(() => {
            // Autoplay blocked — fall back to vibration if available.
            if ('vibrate' in navigator) navigator.vibrate?.([400, 200, 400, 200, 400]);
        });
        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, [incoming]);

    if (!device || !incoming) return null;

    return (
        <div className="absolute inset-0 z-50 bg-gradient-to-b from-slate-950/95 to-slate-800/95 backdrop-blur-sm flex flex-col items-center justify-between py-12 animate-in fade-in">
            <div className="text-center mt-8 px-4">
                <div className="text-slate-300 text-sm uppercase tracking-widest">Incoming call</div>
                <div className="mt-4 text-white text-2xl font-semibold break-all">
                    {lookupHit?.callerName ?? prettyFrom(incoming.from)}
                </div>
                <div className="mt-2 text-slate-400 text-sm font-mono">{incoming.from}</div>
                {lookupHit?.callerName && (
                    <div className="mt-1 text-[11px] text-emerald-300">
                        {lookupHit.lineType ?? ''}{lookupHit.carrierName ? ` · ${lookupHit.carrierName}` : ''}
                    </div>
                )}
                {canLookup && incoming.from && incoming.from.startsWith('+') && !lookupHit?.callerName && (
                    <div className="mt-3 flex justify-center">
                        <LookupButton
                            phone={incoming.from}
                            source="incoming_manual"
                            label="Identify"
                            onResult={(r: LookupResult) => setLookupHit({
                                id: r.id,
                                phone: incoming.from,
                                callerName: r.callerName,
                                callerType: r.callerType,
                                lineType: r.lineType,
                                carrierName: r.carrierName,
                                isValid: true,
                                source: 'incoming_manual',
                            })}
                        />
                    </div>
                )}
            </div>

            <div className="w-32 h-32 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
                <div className="w-20 h-20 rounded-full bg-emerald-500/30 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                        <path d="M19.23 15.26l-2.54-.29a1.5 1.5 0 0 0-1.32.45l-1.84 1.84a14 14 0 0 1-6.59-6.59l1.85-1.85c.34-.34.5-.82.45-1.31l-.29-2.52a1.51 1.51 0 0 0-1.5-1.32H5.03c-.86 0-1.58.72-1.53 1.58.35 6.71 5.74 12.1 12.45 12.45a1.51 1.51 0 0 0 1.58-1.53V16.7c0-.74-.55-1.38-1.3-1.44z" />
                    </svg>
                </div>
            </div>

            <div className="flex items-center justify-around w-full px-12">
                <ActionButton color="bg-rose-600" label="Decline" onClick={device.reject}>
                    <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="currentColor">
                        <path d="M3 12a9 9 0 0118 0v3l-3-2v-1a6 6 0 10-12 0v1l-3 2v-3z" transform="rotate(135 12 12)" />
                    </svg>
                </ActionButton>
                <ActionButton color="bg-emerald-500" label="Accept" onClick={device.accept}>
                    <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="currentColor">
                        <path d="M19.23 15.26l-2.54-.29a1.5 1.5 0 0 0-1.32.45l-1.84 1.84a14 14 0 0 1-6.59-6.59l1.85-1.85c.34-.34.5-.82.45-1.31l-.29-2.52a1.51 1.51 0 0 0-1.5-1.32H5.03c-.86 0-1.58.72-1.53 1.58.35 6.71 5.74 12.1 12.45 12.45a1.51 1.51 0 0 0 1.58-1.53V16.7c0-.74-.55-1.38-1.3-1.44z" />
                    </svg>
                </ActionButton>
            </div>

            <audio
                ref={audioRef}
                src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
                preload="auto"
            />
        </div>
    );
}

function ActionButton({ color, label, onClick, children }: {
    color: string; label: string; onClick: () => void; children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={`w-20 h-20 rounded-full ${color} active:opacity-80 flex items-center justify-center shadow-2xl`}
        >
            {children}
        </button>
    );
}

function prettyFrom(from: string): string {
    if (!from) return 'Unknown';
    if (from.startsWith('client:')) return from.replace('client:', '');
    return from;
}
