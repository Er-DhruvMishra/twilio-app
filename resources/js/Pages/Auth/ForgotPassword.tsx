import AuthShell from '@/Layouts/AuthShell';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <AuthShell title="Reset password" subtitle="We'll email you a reset link">
            <Head title="Forgot Password" />

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Enter the email on your account. If it matches, you'll receive a one-time link to set a new password.
            </p>

            {status && (
                <div className="mb-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-3 text-emerald-300 text-sm">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-3">
                <label className="block">
                    <div className="text-xs text-slate-300 mb-1.5">Email</div>
                    <input
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        autoComplete="username"
                        autoFocus
                        placeholder="you@example.com"
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    {errors.email && <div className="text-rose-400 text-xs mt-1">{errors.email}</div>}
                </label>

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600 mt-1"
                >
                    {processing ? 'Sending…' : 'Email reset link'}
                </button>

                <div className="text-center text-xs text-slate-400 mt-3">
                    Remembered it?{' '}
                    <Link href={route('login')} className="text-sky-400 font-semibold">
                        Back to sign in
                    </Link>
                </div>
            </form>
        </AuthShell>
    );
}
