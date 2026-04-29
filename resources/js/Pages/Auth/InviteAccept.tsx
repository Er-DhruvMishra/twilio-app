import { Head, useForm, Link } from '@inertiajs/react';
import { FormEventHandler } from 'react';

interface Props {
    token: string;
    email: string | null;
    roleName: string | null;
    inviter: string | null;
    error: string | null;
}

export default function InviteAccept({ token, email, roleName, inviter, error }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(`/invite/${token}`);
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
            <Head title="Accept invite" />

            <div className="w-full max-w-md rounded-2xl bg-slate-800/80 border border-white/10 p-6 shadow-2xl">
                <h1 className="text-white text-2xl font-bold mb-1">Join the team</h1>
                <p className="text-slate-400 text-sm mb-5">
                    {error
                        ? error
                        : (
                            <>
                                {inviter ?? 'A teammate'} has invited <span className="font-semibold text-white">{email}</span>
                                {roleName ? <> as a <span className="font-semibold text-white">{roleName}</span></> : null}.
                                Set a password to accept.
                            </>
                        )}
                </p>

                {!error && (
                    <form onSubmit={submit} className="space-y-3">
                        <label className="block">
                            <div className="text-xs text-slate-300 mb-1">Your name</div>
                            <input
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                autoFocus
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                            />
                            {errors.name && <div className="text-rose-400 text-xs mt-1">{errors.name}</div>}
                        </label>
                        <label className="block">
                            <div className="text-xs text-slate-300 mb-1">Password</div>
                            <input
                                type="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                            />
                            {errors.password && <div className="text-rose-400 text-xs mt-1">{errors.password}</div>}
                        </label>
                        <label className="block">
                            <div className="text-xs text-slate-300 mb-1">Confirm password</div>
                            <input
                                type="password"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                        >
                            {processing ? 'Creating account…' : 'Accept invite'}
                        </button>
                    </form>
                )}

                {error && (
                    <Link
                        href="/login"
                        className="block w-full text-center bg-blue-500 text-white rounded-xl py-3 font-semibold active:bg-blue-600"
                    >
                        Go to sign in
                    </Link>
                )}
            </div>
        </div>
    );
}
