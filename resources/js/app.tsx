import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { TwilioDeviceProvider } from '@/Components/TwilioDeviceProvider';
import type { PageProps } from '@/types';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

interface InertiaInitial {
    initialPage: { props: PageProps };
}

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const initial = props as unknown as InertiaInitial;
        const initialProps = initial.initialPage?.props;
        const isAuthed = !!initialProps?.auth?.user;
        const twilioReady = !!initialProps?.twilio?.configured && !!initialProps?.twilio?.phoneNumber;

        const root = createRoot(el);
        root.render(
            <TwilioDeviceProvider enabled={isAuthed && twilioReady}>
                <App {...props} />
            </TwilioDeviceProvider>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});
