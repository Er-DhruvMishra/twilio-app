import { useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light' | 'auto';

const STORE_MODE = 'phoneos.theme.mode';
const STORE_HC = 'phoneos.theme.hc';

function systemPrefersDark(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(mode: ThemeMode, hc: boolean) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const dark = mode === 'dark' || (mode === 'auto' && systemPrefersDark());
    root.classList.toggle('theme-dark', dark);
    root.classList.toggle('theme-light', !dark);
    root.classList.toggle('theme-hc', hc);
}

export function initTheme(): void {
    if (typeof window === 'undefined') return;
    const mode = (localStorage.getItem(STORE_MODE) as ThemeMode) || 'dark';
    const hc = localStorage.getItem(STORE_HC) === '1';
    apply(mode, hc);
}

export function useTheme() {
    const [mode, setModeState] = useState<ThemeMode>(() =>
        (typeof window !== 'undefined' ? (localStorage.getItem(STORE_MODE) as ThemeMode) : null) || 'dark',
    );
    const [highContrast, setHcState] = useState<boolean>(() =>
        typeof window !== 'undefined' && localStorage.getItem(STORE_HC) === '1',
    );

    useEffect(() => apply(mode, highContrast), [mode, highContrast]);

    // React to OS theme changes when in auto mode
    useEffect(() => {
        if (mode !== 'auto' || typeof window === 'undefined') return;
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => apply('auto', highContrast);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [mode, highContrast]);

    const setMode = useCallback((m: ThemeMode) => {
        localStorage.setItem(STORE_MODE, m);
        setModeState(m);
    }, []);
    const setHighContrast = useCallback((v: boolean) => {
        localStorage.setItem(STORE_HC, v ? '1' : '0');
        setHcState(v);
    }, []);

    return { mode, setMode, highContrast, setHighContrast };
}
