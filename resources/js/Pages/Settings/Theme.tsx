import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { ThemeMode, useTheme } from '@/Hooks/useTheme';

export default function ThemeSettings() {
    const { mode, setMode, highContrast, setHighContrast } = useTheme();

    const choice = (value: ThemeMode, label: string, description: string) => (
        <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`w-full text-left rounded-xl px-3 py-3 border transition-colors ${
                mode === value
                    ? 'bg-blue-500/20 border-blue-400'
                    : 'bg-white/5 border-white/10 active:bg-white/10'
            }`}
        >
            <div className="text-sm text-white font-medium flex items-center justify-between">
                {label}
                {mode === value && <span className="text-emerald-300">✓</span>}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{description}</div>
        </button>
    );

    return (
        <AppFrame title="Theme & display" back={route('settings.index')}>
            <Head title="Theme & display" />

            <div className="space-y-2 mb-5">
                <div className="text-xs uppercase tracking-wide text-slate-400 px-1">Appearance</div>
                {choice('dark', 'Dark', 'OLED-friendly default. Easy on the eyes at night.')}
                {choice('light', 'Light', 'Brighter surfaces — better in bright rooms.')}
                {choice('auto', 'Auto', 'Follow your operating system setting.')}
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={highContrast}
                        onChange={(e) => setHighContrast(e.target.checked)}
                        className="mt-1 rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-white">High contrast</div>
                        <div className="text-xs text-slate-400 leading-snug">
                            Strengthens borders and focus rings for low-vision usability. Stacks with light or dark mode.
                        </div>
                    </div>
                </label>
            </div>

            <p className="text-[10px] text-slate-500 mt-4 px-1 leading-relaxed">
                Theme preference is saved to this browser. The Twilio Voice device, Reverb websocket, and push subscriptions are unaffected by switching themes.
            </p>
        </AppFrame>
    );
}
