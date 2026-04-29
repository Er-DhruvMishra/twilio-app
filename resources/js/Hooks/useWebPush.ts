import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

export type WebPushStatus = 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed';

export function useWebPush() {
    const [status, setStatus] = useState<WebPushStatus>('unsubscribed');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const supported = typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;

    const refresh = useCallback(async () => {
        if (!supported) { setStatus('unsupported'); return; }
        if (Notification.permission === 'denied') { setStatus('denied'); return; }
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = await reg?.pushManager.getSubscription();
        setStatus(sub ? 'subscribed' : 'unsubscribed');
    }, [supported]);

    useEffect(() => { refresh(); }, [refresh]);

    const subscribe = useCallback(async () => {
        if (!supported) return;
        setBusy(true); setError(null);
        try {
            const reg = (await navigator.serviceWorker.getRegistration('/sw.js'))
                ?? (await navigator.serviceWorker.register('/sw.js'));
            await navigator.serviceWorker.ready;

            const perm = Notification.permission === 'granted'
                ? 'granted'
                : await Notification.requestPermission();
            if (perm !== 'granted') {
                setStatus(perm === 'denied' ? 'denied' : 'unsubscribed');
                return;
            }

            const r = await axios.get('/api/push/vapid-public-key');
            const vapid = r.data.publicKey as string;
            if (!vapid) throw new Error('VAPID public key missing on server');

            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapid).buffer as ArrayBuffer,
            });

            const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
            await axios.post('/api/push/subscribe', {
                endpoint: json.endpoint,
                public_key: json.keys?.p256dh,
                auth_token: json.keys?.auth,
                content_encoding: 'aesgcm',
            });
            setStatus('subscribed');
        } catch (e: unknown) {
            const err = e as { message?: string };
            setError(err.message ?? 'Failed to subscribe');
        } finally {
            setBusy(false);
        }
    }, [supported]);

    const unsubscribe = useCallback(async () => {
        if (!supported) return;
        setBusy(true); setError(null);
        try {
            const reg = await navigator.serviceWorker.getRegistration('/sw.js');
            const sub = await reg?.pushManager.getSubscription();
            if (sub) {
                await axios.delete('/api/push/subscribe', { data: { endpoint: sub.endpoint } });
                await sub.unsubscribe();
            }
            setStatus('unsubscribed');
        } catch (e: unknown) {
            const err = e as { message?: string };
            setError(err.message ?? 'Failed to unsubscribe');
        } finally {
            setBusy(false);
        }
    }, [supported]);

    const test = useCallback(async () => {
        await axios.post('/api/push/test');
    }, []);

    return { status, error, busy, supported, subscribe, unsubscribe, test, refresh };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}
