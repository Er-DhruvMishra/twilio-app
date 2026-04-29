import axios from 'axios';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { initTheme } from './Hooks/useTheme';

initTheme();
silenceDebugbarCrossOriginNoise();

/**
 * laravel-debugbar's bundled JS instruments every XHR on the page (via a
 * prototype patch on XMLHttpRequest.send) and calls
 * `xhr.getResponseHeader('phpdebugbar*')` on each response to fold debug
 * data into the floating bar. For cross-origin responses (Twilio Voice
 * SDK audio fetches from sdk.twilio.com, third-party CDNs, etc.) the
 * browser refuses the read and prints `Refused to get unsafe header
 * "phpdebugbar*"` for every XHR. We can't whitelist the header on
 * responses we don't control, so we wrap getResponseHeader to short-
 * circuit phpdebugbar reads on cross-origin XHRs — short-circuiting
 * BEFORE the native call avoids the browser's CORS warning entirely.
 *
 * Same-origin XHRs go through the native call as normal, so debugbar
 * keeps capturing AJAX from our own routes (which is the only useful
 * case anyway).
 */
function silenceDebugbarCrossOriginNoise(): void {
    if (typeof XMLHttpRequest === 'undefined') return;
    const native = XMLHttpRequest.prototype.getResponseHeader;
    XMLHttpRequest.prototype.getResponseHeader = function (name: string) {
        if (typeof name === 'string' && name.toLowerCase().startsWith('phpdebugbar')) {
            const url = (this as XMLHttpRequest).responseURL;
            if (url) {
                try {
                    if (new URL(url, window.location.href).origin !== window.location.origin) {
                        return null;
                    }
                } catch { /* malformed URL — fall through to native */ }
            }
        }
        return native.call(this, name);
    };
}

declare global {
    interface Window {
        axios: typeof axios;
        Pusher: typeof Pusher;
        Echo: Echo<'reverb'>;
    }
}

window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.withCredentials = true;

window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY as string,
    wsHost: import.meta.env.VITE_REVERB_HOST as string,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
});
