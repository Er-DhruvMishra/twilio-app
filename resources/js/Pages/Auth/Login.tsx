import AuthShell from '@/Layouts/AuthShell';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });
    const [showPassword, setShowPassword] = useState(false);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthShell title="Welcome back" subtitle="Sign in to your phone">
            <Head title="Log in" />

            {status && (
                <div className="mb-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-3 text-emerald-300 text-sm">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-3">
                <Field
                    label="Email"
                    type="email"
                    value={data.email}
                    onChange={(v) => setData('email', v)}
                    autoComplete="username"
                    autoFocus
                    error={errors.email}
                    placeholder="you@example.com"
                />

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="login-password" className="text-xs text-slate-300">Password</label>
                        {canResetPassword && (
                            <Link
                                href={route('password.request')}
                                className="text-xs text-sky-400 active:opacity-70"
                            >
                                Forgot?
                            </Link>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 pr-14 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 px-2 py-1 text-xs"
                        >
                            {showPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    {errors.password && <div className="text-rose-400 text-xs mt-1">{errors.password}</div>}
                </div>

                <label className="flex items-center gap-2 select-none cursor-pointer">
                    <input
                        type="checkbox"
                        checked={data.remember}
                        onChange={(e) => setData('remember', e.target.checked as false)}
                        className="rounded text-blue-500 bg-white/5 border-white/20 focus:ring-blue-400"
                    />
                    <span className="text-xs text-slate-300">Keep me signed in on this device</span>
                </label>

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600 mt-1"
                >
                    {processing ? 'Signing in…' : 'Sign in'}
                </button>

                {route().has('register') && (
                    <div className="text-center text-xs text-slate-400 mt-3">
                        Don't have an account?{' '}
                        <Link href={route('register')} className="text-sky-400 font-semibold">
                            Create one
                        </Link>
                    </div>
                )}
            </form>
        </AuthShell>
    );
}

function Field({ label, type = 'text', value, onChange, autoComplete, autoFocus, error, placeholder }: {
    label: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    autoComplete?: string;
    autoFocus?: boolean;
    error?: string;
    placeholder?: string;
}) {
    return (
        <label className="block">
            <div className="text-xs text-slate-300 mb-1.5">{label}</div>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                placeholder={placeholder}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
            />
            {error && <div className="text-rose-400 text-xs mt-1">{error}</div>}
        </label>
    );
}
