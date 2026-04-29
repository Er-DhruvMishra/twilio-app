import { useEffect, useState } from 'react';

export type Orientation = 'portrait' | 'landscape';
const ORIENTATION_KEY = 'phoneos.orientation';

/**
 * Shared phone-frame orientation state. Persisted to localStorage so rotating
 * inside the authed shell carries over to login/register screens (and vice
 * versa).
 */
export function useOrientation() {
    const [orientation, setOrientation] = useState<Orientation>(() =>
        (typeof window !== 'undefined' ? (localStorage.getItem(ORIENTATION_KEY) as Orientation) : null) || 'portrait',
    );

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(ORIENTATION_KEY, orientation);
        }
    }, [orientation]);

    // Keep tabs in sync if the user rotates in another window.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onStorage = (e: StorageEvent) => {
            if (e.key === ORIENTATION_KEY && (e.newValue === 'portrait' || e.newValue === 'landscape')) {
                setOrientation(e.newValue);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const toggle = () => setOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'));
    return { orientation, setOrientation, toggle, isLandscape: orientation === 'landscape' };
}
