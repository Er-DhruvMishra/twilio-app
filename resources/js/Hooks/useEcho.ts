import { useEffect, useRef } from 'react';
import type Echo from 'laravel-echo';

type Handler = (payload: unknown) => void;

declare global {
    interface Window {
        Echo: Echo<'reverb'>;
    }
}

export function usePrivateChannel(channel: string | null, listeners: Record<string, Handler>) {
    const listenersRef = useRef(listeners);
    listenersRef.current = listeners;

    useEffect(() => {
        if (!channel || !window.Echo) return;
        const ch = window.Echo.private(channel);
        const events = Object.keys(listenersRef.current);
        events.forEach((event) => {
            ch.listen(event, (payload: unknown) => listenersRef.current[event](payload));
        });
        return () => {
            window.Echo.leave(`private-${channel}`);
        };
    }, [channel]);
}

export function usePresenceChannel<T = unknown>(
    channel: string | null,
    callbacks: {
        here?: (members: T[]) => void;
        joining?: (member: T) => void;
        leaving?: (member: T) => void;
    } = {},
) {
    const cbRef = useRef(callbacks);
    cbRef.current = callbacks;

    useEffect(() => {
        if (!channel || !window.Echo) return;
        const ch = window.Echo.join(channel)
            .here((members: T[]) => cbRef.current.here?.(members))
            .joining((member: T) => cbRef.current.joining?.(member))
            .leaving((member: T) => cbRef.current.leaving?.(member));
        return () => {
            window.Echo.leave(`presence-${channel}`);
        };
    }, [channel]);
}
