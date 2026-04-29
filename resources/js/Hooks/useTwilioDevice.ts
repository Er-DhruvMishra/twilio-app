import { useEffect, useRef, useState, useCallback } from 'react';
import { Device, Call as TwilioCall } from '@twilio/voice-sdk';
import axios from 'axios';

export type DeviceStatus = 'idle' | 'connecting' | 'registering' | 'ready' | 'busy' | 'error';

export interface IncomingCallInfo {
    callSid: string;
    from: string;
    parameters: Record<string, string>;
}

export interface ActiveCallInfo {
    callSid: string | null;
    direction: 'incoming' | 'outgoing';
    from: string | null;
    to: string | null;
    isMuted: boolean;
    onHold: boolean;
    startedAt: number;
}

interface DeviceState {
    status: DeviceStatus;
    error: string | null;
    incoming: IncomingCallInfo | null;
    active: ActiveCallInfo | null;
}

const initialState: DeviceState = {
    status: 'idle',
    error: null,
    incoming: null,
    active: null,
};

export function useTwilioDevice(enabled: boolean = true) {
    const [state, setState] = useState<DeviceState>(initialState);
    const deviceRef = useRef<Device | null>(null);
    const incomingCallRef = useRef<TwilioCall | null>(null);
    const activeCallRef = useRef<TwilioCall | null>(null);

    const fetchToken = useCallback(async (): Promise<string> => {
        const r = await axios.post('/api/twilio/token');
        return r.data.token as string;
    }, []);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        const init = async () => {
            try {
                setState((s) => ({ ...s, status: 'connecting', error: null }));
                const token = await fetchToken();
                if (cancelled) return;

                const device = new Device(token, {
                    logLevel: 1,
                    edge: 'roaming',
                    codecPreferences: ['opus', 'pcmu'] as TwilioCall.Codec[],
                });

                device.on('registered', () => setState((s) => ({ ...s, status: 'ready' })));
                device.on('unregistered', () => setState((s) => ({ ...s, status: 'idle' })));
                device.on('error', (err: { message?: string }) => {
                    setState((s) => ({ ...s, status: 'error', error: err.message ?? 'Twilio device error' }));
                });

                device.on('incoming', (call: TwilioCall) => {
                    incomingCallRef.current = call;
                    const params = (call.parameters ?? {}) as Record<string, string>;
                    setState((s) => ({
                        ...s,
                        incoming: {
                            callSid: params.CallSid ?? '',
                            from: params.From ?? 'Unknown',
                            parameters: params,
                        },
                    }));

                    call.on('cancel', () => clearIncoming());
                    call.on('reject', () => clearIncoming());
                    call.on('disconnect', () => {
                        clearIncoming();
                        clearActive();
                    });
                });

                device.on('tokenWillExpire', async () => {
                    try {
                        const fresh = await fetchToken();
                        device.updateToken(fresh);
                    } catch (e) {
                        console.error('Failed to refresh Twilio token', e);
                    }
                });

                deviceRef.current = device;
                setState((s) => ({ ...s, status: 'registering' }));
                await device.register();
            } catch (e) {
                if (cancelled) return;
                const err = e as { response?: { data?: { message?: string } }; message?: string };
                const message = err.response?.data?.message ?? err.message ?? 'Failed to initialize Twilio device';
                setState((s) => ({ ...s, status: 'error', error: message }));
            }
        };

        init();

        return () => {
            cancelled = true;
            try {
                deviceRef.current?.disconnectAll();
                deviceRef.current?.destroy();
            } catch { /* noop */ }
            deviceRef.current = null;
            incomingCallRef.current = null;
            activeCallRef.current = null;
        };
    }, [enabled, fetchToken]);

    const clearIncoming = () => {
        incomingCallRef.current = null;
        setState((s) => ({ ...s, incoming: null }));
    };
    const clearActive = () => {
        activeCallRef.current = null;
        setState((s) => ({ ...s, active: null, status: deviceRef.current ? 'ready' : 'idle' }));
    };

    const dial = useCallback(async (to: string) => {
        const device = deviceRef.current;
        if (!device) throw new Error('Voice device not ready yet');
        setState((s) => ({ ...s, status: 'busy', error: null }));

        const call = await device.connect({ params: { To: to } });
        activeCallRef.current = call;
        attachActiveListeners(call, 'outgoing', null, to);
        return call;
    }, []);

    const accept = useCallback(() => {
        const call = incomingCallRef.current;
        if (!call) return;
        const params = (call.parameters ?? {}) as Record<string, string>;
        call.accept();
        activeCallRef.current = call;
        incomingCallRef.current = null;
        setState((s) => ({ ...s, incoming: null, status: 'busy' }));
        attachActiveListeners(call, 'incoming', params.From ?? null, null);
    }, []);

    const reject = useCallback(() => {
        incomingCallRef.current?.reject();
        clearIncoming();
    }, []);

    const hangUp = useCallback(() => {
        activeCallRef.current?.disconnect();
        clearActive();
    }, []);

    const toggleMute = useCallback(() => {
        const call = activeCallRef.current;
        if (!call) return;
        const next = !call.isMuted();
        call.mute(next);
        setState((s) => s.active ? { ...s, active: { ...s.active, isMuted: next } } : s);
    }, []);

    const sendDigits = useCallback((digits: string) => {
        activeCallRef.current?.sendDigits(digits);
    }, []);

    function attachActiveListeners(call: TwilioCall, direction: 'incoming' | 'outgoing', from: string | null, to: string | null) {
        const initial: ActiveCallInfo = {
            callSid: null,
            direction,
            from,
            to,
            isMuted: false,
            onHold: false,
            startedAt: Date.now(),
        };
        setState((s) => ({ ...s, active: initial, status: 'busy' }));

        call.on('accept', (c: TwilioCall) => {
            const sid = (c.parameters as Record<string, string> | undefined)?.CallSid ?? null;
            setState((s) => s.active ? { ...s, active: { ...s.active, callSid: sid } } : s);
        });
        call.on('disconnect', () => clearActive());
        call.on('cancel', () => clearActive());
        call.on('error', (err: { message?: string }) => {
            setState((s) => ({ ...s, error: err.message ?? 'Call error' }));
            clearActive();
        });
    }

    return {
        ...state,
        dial,
        accept,
        reject,
        hangUp,
        toggleMute,
        sendDigits,
    };
}
