/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

interface PushPayload {
    type: 'incoming_call' | 'sms' | 'voicemail' | 'fax' | 'mail' | 'conversation' | 'test';
    callId?: number;
    callSid?: string;
    from?: string;
    callerName?: string;
    messageId?: number;
    threadKey?: string;
    voicemailId?: number;
    faxId?: number;
    pages?: number;
    mailId?: number;
    threadId?: number;
    subject?: string;
    conversationId?: number;
    channel?: 'chat' | 'rcs' | 'whatsapp' | 'facebook';
    preview?: string;
    duration?: number;
    ts?: number;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event: PushEvent) => {
    if (!event.data) return;
    let payload: PushPayload;
    try {
        payload = event.data.json() as PushPayload;
    } catch {
        payload = { type: 'test' };
    }

    const { title, body, options } = renderNotification(payload);
    event.waitUntil(self.registration.showNotification(title, options));

    // Wake any open clients so the in-app UI also reacts immediately.
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            clients.forEach((c) => c.postMessage({ source: 'sw', payload }));
        }),
    );

    function renderNotification(p: PushPayload): { title: string; body: string; options: NotificationOptions } {
        switch (p.type) {
            case 'incoming_call':
                return {
                    title: 'Incoming call',
                    body: p.callerName ?? p.from ?? 'Unknown',
                    options: {
                        body: p.callerName ?? p.from ?? 'Unknown',
                        tag: `call-${p.callSid ?? p.callId}`,
                        requireInteraction: true,
                        data: p,
                        actions: [
                            { action: 'accept', title: 'Accept' } as NotificationAction,
                            { action: 'reject', title: 'Decline' } as NotificationAction,
                        ],
                    },
                };
            case 'sms':
                return {
                    title: `SMS from ${p.from ?? 'unknown'}`,
                    body: p.preview ?? '',
                    options: {
                        body: p.preview ?? '',
                        tag: `sms-${p.threadKey ?? p.messageId}`,
                        data: p,
                    },
                };
            case 'voicemail':
                return {
                    title: 'New voicemail',
                    body: `${p.from ?? 'Unknown'} · ${p.duration ?? 0}s`,
                    options: { body: `${p.from ?? 'Unknown'} · ${p.duration ?? 0}s`, tag: `vm-${p.voicemailId}`, data: p },
                };
            case 'fax': {
                const pages = p.pages ?? 0;
                const body = pages > 0 ? `${pages} page${pages > 1 ? 's' : ''} from ${p.from ?? 'unknown'}` : `From ${p.from ?? 'unknown'}`;
                return {
                    title: 'New fax',
                    body,
                    options: { body, tag: `fax-${p.faxId}`, data: p },
                };
            }
            case 'mail':
                return {
                    title: `Mail from ${p.from ?? 'unknown'}`,
                    body: p.subject ?? '(no subject)',
                    options: { body: p.subject ?? '(no subject)', tag: `mail-${p.threadId ?? p.mailId}`, data: p },
                };
            case 'conversation': {
                const channelLabel = p.channel === 'chat' ? 'Chat'
                    : p.channel === 'rcs' ? 'RCS'
                        : p.channel === 'whatsapp' ? 'WhatsApp'
                            : p.channel === 'facebook' ? 'Messenger'
                                : 'Message';
                return {
                    title: `${channelLabel} · ${p.from ?? 'message'}`,
                    body: p.preview ?? '',
                    options: { body: p.preview ?? '', tag: `conv-${p.conversationId}`, data: p },
                };
            }
            default:
                return { title: 'Virtual Phone OS', body: 'Notification', options: { body: 'Notification' } };
        }
    }
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
    const payload = event.notification.data as PushPayload;
    event.notification.close();

    if (payload.type === 'incoming_call' && event.action === 'reject' && payload.callId) {
        event.waitUntil(
            fetch(`/api/calls/${payload.callId}/reject`, {
                method: 'POST',
                headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
                credentials: 'include',
            }),
        );
        return;
    }

    const targetUrl = payload.type === 'incoming_call'
        ? '/phone'
        : payload.type === 'sms' && payload.threadKey
            ? `/messages/${encodeURIComponent(payload.threadKey)}`
            : payload.type === 'voicemail'
                ? '/voicemail'
                : payload.type === 'fax' && payload.faxId
                    ? `/fax/${payload.faxId}`
                    : payload.type === 'fax'
                        ? '/fax'
                        : payload.type === 'mail' && payload.threadId
                            ? `/mail/${payload.threadId}`
                            : payload.type === 'mail'
                                ? '/mail'
                                : payload.type === 'conversation' && payload.conversationId
                                    ? `/${payload.channel ?? 'chat'}/${payload.conversationId}`
                                    : payload.type === 'conversation'
                                        ? `/${payload.channel ?? 'chat'}`
                                        : '/home';

    event.waitUntil(
        (async () => {
            const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            const open = allClients.find((c) => new URL(c.url).origin === self.location.origin) as WindowClient | undefined;
            if (open) {
                await open.focus();
                open.postMessage({ source: 'sw', click: true, action: event.action ?? 'open', payload });
                return;
            }
            await self.clients.openWindow(targetUrl);
        })(),
    );
});
