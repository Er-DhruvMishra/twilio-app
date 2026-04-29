import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useDevice } from '@/Components/TwilioDeviceProvider';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const DTMF_KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function InCall() {
    const device = useDevice();
    const [elapsed, setElapsed] = useState(0);
    const [keypadOpen, setKeypadOpen] = useState(false);
    const [dtmfBuffer, setDtmfBuffer] = useState('');

    const [recording, setRecording] = useState(false);
    const [recordBusy, setRecordBusy] = useState(false);
    const [speakerLoud, setSpeakerLoud] = useState(false);
    const [speakerSupported, setSpeakerSupported] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const audioOutputsRef = useRef<MediaDeviceInfo[]>([]);

    const active = device.active;

    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setElapsed(Math.floor((Date.now() - active.startedAt) / 1000)), 1000);
        return () => clearInterval(id);
    }, [active]);

    useEffect(() => {
        if (!active) router.visit(route('phone.dialer'));
    }, [active]);

    // Probe available audio outputs once the call is up. We use the result
    // when Speaker is toggled.
    useEffect(() => {
        if (!active) return;
        if (!navigator.mediaDevices?.enumerateDevices) {
            setSpeakerSupported(false);
            return;
        }
        navigator.mediaDevices.enumerateDevices().then((list) => {
            audioOutputsRef.current = list.filter((d) => d.kind === 'audiooutput');
            const sinkSupported = typeof (HTMLMediaElement.prototype as any).setSinkId === 'function';
            if (!sinkSupported) setSpeakerSupported(false);
        }).catch(() => setSpeakerSupported(false));
    }, [active]);

    if (!active) return null;

    const peer = active.from ?? active.to ?? 'Connecting…';

    const sendDtmf = (digit: string) => {
        device.sendDigits(digit);
        setDtmfBuffer((b) => (b + digit).slice(-20));
    };

    const toggleRecord = async () => {
        if (recordBusy) return;
        if (!active.callSid) {
            setError('Call SID not yet known — recording can start after the call connects.');
            return;
        }
        setRecordBusy(true); setError(null);
        try {
            const path = recording ? 'stop' : 'start';
            await axios.post(`/api/calls/${active.callSid}/recording/${path}`);
            setRecording(!recording);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Recording action failed');
        } finally { setRecordBusy(false); }
    };

    /**
     * Speaker = "loud" mode. We toggle the audio sink on every <audio>
     * element to a non-default output (typically the laptop's main
     * speakers vs the headset/communications device). Falls back to
     * bumping volume to max if setSinkId isn't available.
     */
    const toggleSpeaker = async () => {
        const next = !speakerLoud;
        setSpeakerLoud(next);

        if (!speakerSupported) {
            document.querySelectorAll('audio').forEach((el) => { (el as HTMLAudioElement).volume = next ? 1 : 0.7; });
            return;
        }

        const outputs = audioOutputsRef.current;
        const target = next
            ? outputs.find((d) => /speaker|loud/i.test(d.label) && d.deviceId !== 'default')?.deviceId
                ?? outputs.find((d) => d.deviceId !== 'default' && d.deviceId !== 'communications')?.deviceId
                ?? 'default'
            : 'default';

        try {
            await Promise.all(
                Array.from(document.querySelectorAll('audio')).map((el) => {
                    const a = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
                    return a.setSinkId ? a.setSinkId(target) : Promise.resolve();
                }),
            );
        } catch {
            // Browser refused; toggle state stays as the user set it.
        }
    };

    return (
        <AppFrame title="In Call" back={route('home')}>
            <Head title="In Call" />
            <div className="flex flex-col items-center pt-4 pb-2 px-2 h-full">
                <div className="text-white text-lg font-semibold text-center break-all">{peer}</div>
                <div className="text-slate-400 text-sm tabular-nums mt-0.5">{formatDuration(elapsed)}</div>

                <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                    {recording && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                            Recording
                        </span>
                    )}
                    {active.isMuted && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                            Muted
                        </span>
                    )}
                    {speakerLoud && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                            Speaker
                        </span>
                    )}
                </div>

                {error && (
                    <div className="mt-2 text-[10px] text-rose-400 max-w-[260px] text-center">{error}</div>
                )}

                {keypadOpen ? (
                    <div className="mt-4 w-full">
                        {dtmfBuffer && (
                            <div className="text-center font-mono text-xl text-white tracking-wide mb-2">{dtmfBuffer}</div>
                        )}
                        <div className="grid grid-cols-3 gap-2 px-3">
                            {DTMF_KEYS.map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => sendDtmf(d)}
                                    className="aspect-square rounded-full bg-white/10 active:bg-white/25 flex items-center justify-center text-white text-xl"
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setKeypadOpen(false)}
                            className="mt-3 w-full text-center text-sky-400 text-xs"
                        >
                            Hide keypad
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-x-4 gap-y-6 mt-6 w-full px-4">
                        <ControlButton
                            active={active.isMuted}
                            onClick={device.toggleMute}
                            label={active.isMuted ? 'Unmute' : 'Mute'}
                            icon={<MicIcon muted={active.isMuted} />}
                        />
                        <ControlButton onClick={() => setKeypadOpen(true)} label="Keypad" icon={<KeypadIcon />} />
                        <ControlButton
                            active={speakerLoud}
                            onClick={toggleSpeaker}
                            label="Speaker"
                            icon={<SpeakerIcon loud={speakerLoud} />}
                        />
                        <ControlButton
                            active={recording}
                            onClick={toggleRecord}
                            disabled={recordBusy}
                            label={recording ? 'Stop rec' : 'Record'}
                            icon={<RecordIcon active={recording} />}
                            tone={recording ? 'rose' : undefined}
                        />
                        <ControlButton onClick={() => {}} label="Hold" icon={<HoldIcon />} disabled />
                        <ControlButton onClick={() => {}} label="Transfer" icon={<TransferIcon />} disabled />
                    </div>
                )}

                <button
                    type="button"
                    onClick={device.hangUp}
                    aria-label="End call"
                    className="mt-auto mb-3 w-16 h-16 rounded-full bg-rose-600 active:bg-rose-700 flex items-center justify-center shadow-lg"
                >
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor" aria-hidden="true">
                        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85a.96.96 0 0 1-.65.26.97.97 0 0 1-.7-.29L.29 13.08a.99.99 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.46a.97.97 0 0 1-.7.29.96.96 0 0 1-.65-.25 11.6 11.6 0 0 0-2.67-1.85.99.99 0 0 1-.56-.9v-3.1A15.5 15.5 0 0 0 12 9z" transform="rotate(135 12 12)" />
                    </svg>
                </button>
            </div>
        </AppFrame>
    );
}

function ControlButton({ icon, label, onClick, active, disabled, tone }: {
    icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean; tone?: 'rose';
}) {
    const activeBg = tone === 'rose' ? 'bg-rose-500 text-white' : 'bg-white text-slate-900';
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="flex flex-col items-center gap-1.5 disabled:opacity-30"
        >
            <span className={`w-14 h-14 rounded-full ${active ? activeBg : 'bg-white/10 text-white'} flex items-center justify-center active:bg-white/20`}>
                {icon}
            </span>
            <span className="text-white text-xs">{label}</span>
        </button>
    );
}

function formatDuration(s: number): string {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, '0')}`;
}

const MicIcon = ({ muted }: { muted: boolean }) => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1 M12 18v3 M8 21h8" />
        {muted && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />}
    </svg>
);
const KeypadIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" aria-hidden="true">
        {[0,1,2,3].flatMap((r) => [0,1,2].map((c) => <circle key={`${r}-${c}`} cx={6 + c*6} cy={6 + r*4} r="1.4" />))}
    </svg>
);
const SpeakerIcon = ({ loud }: { loud: boolean }) => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        {loud && <path d="M19 12a4 4 0 0 0-2-3.5 M22 12a7 7 0 0 0-3-5.7" />}
        {!loud && <line x1="22" y1="9" x2="16" y2="15" />}
    </svg>
);
const HoldIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
);
const TransferIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3l5 5-5 5 M21 8H8 M8 21l-5-5 5-5 M3 16h13" />
    </svg>
);
const RecordIcon = ({ active }: { active: boolean }) => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r={active ? 5 : 6} />
        {active && <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />}
    </svg>
);
