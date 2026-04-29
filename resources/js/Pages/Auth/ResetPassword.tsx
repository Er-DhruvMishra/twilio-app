import AuthShell from '@/Layouts/AuthShell';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ResetPassword({
    token,
    email,
}: {
    token: string;
    email: string;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <AuthShell title="Set new password" subtitle="Choose a strong password to finish">
            <Head title="Reset Password" />

            <form onSubmit={submit} className="space-y-3">
                <label className="block">
                    <div className="text-xs text-slate-300 mb-1.5">Email</div>
                    <input
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        autoComplete="username"
                        readOnly
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    {errors.email && <div className="text-rose-400 text-xs mt-1">{errors.email}</div>}
                </label>

                <label className="block">
                    <div className="text-xs text-slate-300 mb-1.5">New password</div>
                    <input
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        autoComplete="new-password"
                        autoFocus
                        placeholder="At least 8 characters"
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    {errors.password && <div className="text-rose-400 text-xs mt-1">{errors.password}</div>}
                </label>

                <label className="block">
                    <div className="text-xs text-slate-300 mb-1.5">Confirm new password</div>
                    <input
                        type="password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    {errors.password_confirmation && <div className="text-rose-400 text-xs mt-1">{errors.password_confirmation}</div>}
                </label>

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600 mt-1"
                >
                    {processing ? 'Updating…' : 'Reset password'}
                </button>
            </form>
        </AuthShell>
    );
}
