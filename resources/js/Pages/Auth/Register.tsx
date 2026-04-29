import AuthShell from '@/Layouts/AuthShell';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <AuthShell title="Create your account" subtitle="Set up your virtual phone in seconds">
            <Head title="Register" />

            <form onSubmit={submit} className="space-y-3">
                <Field
                    label="Name"
                    value={data.name}
                    onChange={(v) => setData('name', v)}
                    autoComplete="name"
                    autoFocus
                    required
                    error={errors.name}
                    placeholder="Asha Patel"
                />
                <Field
                    label="Email"
                    type="email"
                    value={data.email}
                    onChange={(v) => setData('email', v)}
                    autoComplete="username"
                    required
                    error={errors.email}
                    placeholder="you@example.com"
                />
                <Field
                    label="Password"
                    type="password"
                    value={data.password}
                    onChange={(v) => setData('password', v)}
                    autoComplete="new-password"
                    required
                    error={errors.password}
                    placeholder="At least 8 characters"
                />
                <Field
                    label="Confirm password"
                    type="password"
                    value={data.password_confirmation}
                    onChange={(v) => setData('password_confirmation', v)}
                    autoComplete="new-password"
                    required
                    error={errors.password_confirmation}
                />

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600 mt-1"
                >
                    {processing ? 'Creating account…' : 'Create account'}
                </button>

                <div className="text-center text-xs text-slate-400 mt-3">
                    Already have an account?{' '}
                    <Link href={route('login')} className="text-sky-400 font-semibold">
                        Sign in
                    </Link>
                </div>
            </form>
        </AuthShell>
    );
}

function Field({ label, type = 'text', value, onChange, autoComplete, autoFocus, error, placeholder, required }: {
    label: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    autoComplete?: string;
    autoFocus?: boolean;
    error?: string;
    placeholder?: string;
    required?: boolean;
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
                required={required}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
            />
            {error && <div className="text-rose-400 text-xs mt-1">{error}</div>}
        </label>
    );
}
