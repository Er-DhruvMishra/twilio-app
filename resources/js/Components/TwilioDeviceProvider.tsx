import { createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';
import { useTwilioDevice } from '@/Hooks/useTwilioDevice';

type DeviceCtx = ReturnType<typeof useTwilioDevice> | null;

const Ctx = createContext<DeviceCtx>(null);

interface Props {
    children: ReactNode;
    enabled: boolean;
}

export function TwilioDeviceProvider({ children, enabled }: Props) {
    const device = useTwilioDevice(enabled);

    // Auto-route to the full Calling screen the moment a call goes active —
    // covers both outbound dial (Dialer green button → device.dial) and
    // inbound accept (IncomingCallSheet → device.accept). Skipped if the
    // user is already on /phone/* so we don't loop or interrupt the dialer
    // page mid-DTMF.
    const wasActiveRef = useRef(false);
    useEffect(() => {
        const isActive = !!device.active;
        if (isActive && !wasActiveRef.current) {
            const path = typeof window !== 'undefined' ? window.location.pathname : '';
            if (!path.startsWith('/phone/in-call')) {
                router.visit(route('phone.in-call'));
            }
        }
        wasActiveRef.current = isActive;
    }, [device.active]);

    return <Ctx.Provider value={device}>{children}</Ctx.Provider>;
}

export function useDevice() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useDevice() must be used inside <TwilioDeviceProvider>');
    return ctx;
}

export function useDeviceOptional() {
    return useContext(Ctx);
}
