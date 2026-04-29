import AuthShell from '@/Layouts/AuthShell';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('password.confirm'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthShell title="Confirm password" subtitle="Secure area — verify it's you">
            <Head title="Confirm Password" />

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Please re-enter your password to continue to the secure section of the app.
            </p>

            <form onSubmit={submit} className="space-y-3">
                <label className="block">
                    <div className="text-xs text-slate-300 mb-1.5">Password</div>
                    <input
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        autoComplete="current-password"
                        autoFocus
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    {errors.password && <div className="text-rose-400 text-xs mt-1">{errors.password}</div>}
                </label>

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600 mt-1"
                >
                    {processing ? 'Verifying…' : 'Confirm'}
                </button>
            </form>
        </AuthShell>
    );
}
