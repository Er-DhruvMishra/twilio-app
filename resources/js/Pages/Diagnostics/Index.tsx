import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

type PermState = 'unknown' | 'prompt' | 'granted' | 'denied';

interface DeviceInfo {
    deviceId: string;
    label: string;
    kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

/**
 * Self-contained diagnostic for browser audio + video hardware. Used to
 * triage "I can't hear them" / "they can't see me" call complaints before
 * blaming Twilio. No backend round-trips; everything is browser API.
 */
export default function Diagnostics() {
    const [micPerm, setMicPerm] = useState<PermState>('unknown');
    const [camPerm, setCamPerm] = useState<PermState>('unknown');
    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [micActive, setMicActive] = useState(false);
    const [camActive, setCamActive] = useState(false);
    const [micLevel, setMicLevel] = useState(0);
    const [outputDeviceId, setOutputDeviceId] = useState<string | null>(null);
    const [tonePlaying, setTonePlaying] = useState(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const videoStreamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const animationRef = useRef<number | null>(null);
    const oscRef = useRef<OscillatorNode | null>(null);

    // Check permission states without prompting where possible.
    useEffect(() => {
        const probe = async (name: 'microphone' | 'camera', set: (p: PermState) => void) => {
            const navAny = navigator as any;
            if (!navAny.permissions?.query) {
                set('unknown');
                return;
            }
            try {
                const res = await navAny.permissions.query({ name });
                set(res.state);
                res.onchange = () => set(res.state);
            } catch { set('unknown'); }
        };
        probe('microphone', setMicPerm);
        probe('camera', setCamPerm);
        refreshDevices();
        return () => {
            stopAll();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshDevices = async () => {
        try {
            const list = await navigator.mediaDevices.enumerateDevices();
            setDevices(list.map((d) => ({ deviceId: d.deviceId, label: d.label, kind: d.kind as DeviceInfo['kind'] })));
        } catch (e: unknown) {
            setError((e as Error).message);
        }
    };

    const startMic = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;
            setMicActive(true);
            setMicPerm('granted');
            await refreshDevices();
            // Live level meter via Web Audio AnalyserNode.
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioCtxRef.current = ctx;
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            src.connect(analyser);
            const buffer = new Uint8Array(analyser.fftSize);
            const tick = () => {
                analyser.getByteTimeDomainData(buffer);
                let peak = 0;
                for (let i = 0; i < buffer.length; i++) {
                    const v = Math.abs(buffer[i] - 128) / 128;
                    if (v > peak) peak = v;
                }
                setMicLevel(peak);
                animationRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (e: unknown) {
            const err = e as { name?: string; message?: string };
            setMicPerm(err.name === 'NotAllowedError' ? 'denied' : 'unknown');
            setError(err.message ?? 'Could not open microphone');
        }
    };

    const stopMic = () => {
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
        setMicActive(false);
        setMicLevel(0);
    };

    const startCam = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
            videoStreamRef.current = stream;
            setCamActive(true);
            setCamPerm('granted');
            if (videoRef.current) videoRef.current.srcObject = stream;
            await refreshDevices();
        } catch (e: unknown) {
            const err = e as { name?: string; message?: string };
            setCamPerm(err.name === 'NotAllowedError' ? 'denied' : 'unknown');
            setError(err.message ?? 'Could not open camera');
        }
    };

    const stopCam = () => {
        videoStreamRef.current?.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCamActive(false);
    };

    const playTone = () => {
        if (tonePlaying) {
            oscRef.current?.stop();
            oscRef.current?.disconnect();
            oscRef.current = null;
            setTonePlaying(false);
            return;
        }
        const ctx = audioCtxRef.current ?? new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 440; // A4 — distinctive but not painful
        gain.gain.value = 0.05;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        oscRef.current = osc;
        setTonePlaying(true);
    };

    const setSink = async (deviceId: string) => {
        setOutputDeviceId(deviceId);
        const a = audioRef.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
        if (a?.setSinkId) {
            try { await a.setSinkId(deviceId); }
            catch (e: unknown) { setError((e as Error).message); }
        }
    };

    const stopAll = () => {
        stopMic();
        stopCam();
        oscRef.current?.stop();
        oscRef.current = null;
        setTonePlaying(false);
    };

    const audioInputs = devices.filter((d) => d.kind === 'audioinput');
    const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');

    return (
        <AppFrame title="Diagnostics" back={route('home')}>
            <Head title="Mic / Video diagnostics" />

            <div className="rounded-2xl bg-blue-500/5 border border-blue-400/20 p-3 text-blue-200 text-xs leading-relaxed mb-4">
                Run these checks before joining a call to make sure your mic, camera, and speakers work. Nothing is sent to a server — purely a browser-side test.
            </div>

            <Section title="Permissions">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <PermPill label="Microphone" state={micPerm} />
                    <PermPill label="Camera" state={camPerm} />
                </div>
                <div className="text-[10px] text-slate-500 mt-2">
                    Browser permissions persist per-origin. If denied, click the lock icon in the URL bar to reset.
                </div>
            </Section>

            <Section title="Microphone test">
                <div className="flex items-center gap-2 mb-3">
                    {!micActive ? (
                        <button type="button" onClick={startMic} className="bg-emerald-500 text-white text-xs font-semibold rounded-lg px-3 py-2 active:bg-emerald-600">
                            Start
                        </button>
                    ) : (
                        <button type="button" onClick={stopMic} className="bg-rose-500 text-white text-xs font-semibold rounded-lg px-3 py-2 active:bg-rose-600">
                            Stop
                        </button>
                    )}
                    <span className="text-[10px] text-slate-400">{micActive ? 'Speak — bar should jump when you talk' : 'Open your mic and watch the level meter'}</span>
                </div>
                <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                    <div
                        className="h-full transition-[width] duration-75"
                        style={{
                            width: `${Math.min(100, Math.round(micLevel * 200))}%`,
                            backgroundColor: micLevel > 0.6 ? '#f43f5e' : micLevel > 0.2 ? '#22c55e' : '#475569',
                        }}
                    />
                </div>
            </Section>

            <Section title="Camera test">
                <div className="flex items-center gap-2 mb-3">
                    {!camActive ? (
                        <button type="button" onClick={startCam} className="bg-emerald-500 text-white text-xs font-semibold rounded-lg px-3 py-2 active:bg-emerald-600">
                            Start
                        </button>
                    ) : (
                        <button type="button" onClick={stopCam} className="bg-rose-500 text-white text-xs font-semibold rounded-lg px-3 py-2 active:bg-rose-600">
                            Stop
                        </button>
                    )}
                    <span className="text-[10px] text-slate-400">Preview is local-only.</span>
                </div>
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full aspect-video rounded-xl bg-slate-950 object-cover"
                />
            </Section>

            <Section title="Speaker test">
                <div className="flex items-center gap-2 mb-2">
                    <button type="button" onClick={playTone} className={`text-xs font-semibold rounded-lg px-3 py-2 active:opacity-80 ${tonePlaying ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'}`}>
                        {tonePlaying ? 'Stop tone' : 'Play 440 Hz tone'}
                    </button>
                </div>
                {audioOutputs.length > 0 && typeof (HTMLMediaElement.prototype as any).setSinkId === 'function' && (
                    <label className="block">
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Output device</div>
                        <select
                            value={outputDeviceId ?? ''}
                            onChange={(e) => setSink(e.target.value)}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-400"
                        >
                            <option value="" className="bg-slate-800">— default —</option>
                            {audioOutputs.map((d) => (
                                <option key={d.deviceId} value={d.deviceId} className="bg-slate-800">
                                    {d.label || `Output ${d.deviceId.slice(0, 6)}`}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <audio ref={audioRef} className="hidden" />
            </Section>

            <Section title="Detected devices">
                <DeviceList kind="Mics" items={audioInputs} />
                <DeviceList kind="Cameras" items={videoInputs} />
                <DeviceList kind="Speakers" items={audioOutputs} />
                <button
                    type="button"
                    onClick={refreshDevices}
                    className="mt-2 text-xs text-sky-300 px-2 py-1 active:opacity-70"
                >
                    Refresh
                </button>
            </Section>

            <Section title="Browser context">
                <KV k="User agent" v={navigator.userAgent} mono />
                <KV k="Origin (must be HTTPS for mic/cam)" v={window.location.origin} mono />
                <KV k="Service worker" v={navigator.serviceWorker ? 'available' : 'not available'} />
                <KV k="WebRTC" v={(window as any).RTCPeerConnection ? 'available' : 'not available'} />
            </Section>

            {error && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3 text-rose-300 text-xs">{error}</div>
            )}
        </AppFrame>
    );
}

function PermPill({ label, state }: { label: string; state: PermState }) {
    const tones: Record<PermState, string> = {
        unknown: 'bg-slate-700/40 text-slate-300',
        prompt: 'bg-amber-500/20 text-amber-300',
        granted: 'bg-emerald-500/20 text-emerald-300',
        denied: 'bg-rose-500/20 text-rose-300',
    };
    return (
        <div className="rounded-lg bg-white/5 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
            <span className={`inline-block mt-0.5 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${tones[state]}`}>{state}</span>
        </div>
    );
}

function DeviceList({ kind, items }: { kind: string; items: DeviceInfo[] }) {
    return (
        <div className="mb-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{kind} ({items.length})</div>
            {items.length === 0 ? (
                <div className="text-[10px] text-slate-500">None detected</div>
            ) : (
                <ul className="space-y-0.5">
                    {items.map((d) => (
                        <li key={d.deviceId} className="text-[11px] text-slate-200 truncate" title={d.label}>
                            • {d.label || <span className="italic text-slate-500">label hidden — grant permission first</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
    return (
        <div className="mb-1.5">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">{k}</div>
            <div className={`text-[11px] text-slate-200 break-all ${mono ? 'font-mono' : ''}`}>{v}</div>
        </div>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
    </section>
);
