import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { FormEventHandler, useState } from 'react';

interface Props extends Record<string, unknown> {
    mustVerifyEmail: boolean;
    status?: string;
    profile?: { name: string; email: string; personalPhoneE164: string | null };
}

export default function Edit({ mustVerifyEmail, status, profile }: PageProps<Props>) {
    return (
        <AppFrame title="Profile" back={route('home')}>
            <Head title="Profile" />

            <div className="space-y-4">
                <ProfileInfo mustVerifyEmail={mustVerifyEmail} status={status} profile={profile} />
                <PasswordForm />
                <SignOutSection />
                <DeleteAccountForm />
            </div>
        </AppFrame>
    );
}

function SignOutSection() {
    const logout = () => {
        if (!confirm('Sign out of Virtual Phone OS?')) return;
        router.post('/logout');
    };

    return (
        <Section title="Session">
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-400 leading-relaxed">
                    End this browser session. Your call history, contacts and Twilio config stay safe.
                </div>
                <button
                    type="button"
                    onClick={logout}
                    className="bg-rose-500 text-white rounded-xl px-4 py-2 text-sm font-semibold active:bg-rose-600 shrink-0"
                >
                    Sign out
                </button>
            </div>
        </Section>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
        </section>
    );
}

function Field({ label, type = 'text', value, onChange, error, autoComplete }: {
    label: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
    autoComplete?: string;
}) {
    return (
        <label className="block">
            <div className="text-xs text-slate-300 mb-1.5">{label}</div>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                autoComplete={autoComplete}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
            />
            {error && <div className="text-rose-400 text-xs mt-1">{error}</div>}
        </label>
    );
}

function ProfileInfo({ mustVerifyEmail, status, profile }: { mustVerifyEmail: boolean; status?: string; profile?: { name: string; email: string; personalPhoneE164: string | null } }) {
    const { auth } = usePage<PageProps>().props;
    const { data, setData, patch, errors, processing, recentlySuccessful } = useForm({
        name: profile?.name ?? auth.user?.name ?? '',
        email: profile?.email ?? auth.user?.email ?? '',
        personal_phone_e164: profile?.personalPhoneE164 ?? '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('profile.update'));
    };

    return (
        <Section title="Account">
            <form onSubmit={submit} className="space-y-3">
                <Field label="Name" value={data.name} onChange={(v) => setData('name', v)} error={errors.name} autoComplete="name" />
                <Field label="Email" type="email" value={data.email} onChange={(v) => setData('email', v)} error={errors.email} autoComplete="email" />
                <Field
                    label="Personal phone (E.164)"
                    type="tel"
                    value={data.personal_phone_e164}
                    onChange={(v) => setData('personal_phone_e164', v)}
                    error={errors.personal_phone_e164}
                    autoComplete="tel"
                />
                <p className="text-[10px] text-slate-500 -mt-1">
                    Your own line — used for forwarding fallbacks and simultaneous-ring lists. Format: +1 415 555 0123.
                </p>

                {mustVerifyEmail && !auth.user?.email_verified_at && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 p-3 text-amber-200 text-xs">
                        Your email address is unverified.{' '}
                        <Link
                            href={route('verification.send')}
                            method="post"
                            as="button"
                            className="underline font-semibold"
                        >
                            Resend verification email
                        </Link>
                    </div>
                )}
                {status === 'verification-link-sent' && (
                    <div className="text-emerald-400 text-xs">A new verification link has been sent.</div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                        type="submit"
                        disabled={processing}
                        className="bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {processing ? 'Saving…' : 'Save'}
                    </button>
                    {recentlySuccessful && <span className="text-emerald-400 text-xs">Saved.</span>}
                </div>
            </form>
        </Section>
    );
}

function PasswordForm() {
    const { data, setData, put, errors, reset, processing, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errs) => {
                if (errs.password) reset('password', 'password_confirmation');
                if (errs.current_password) reset('current_password');
            },
        });
    };

    return (
        <Section title="Change password">
            <form onSubmit={submit} className="space-y-3">
                <Field label="Current password" type="password" value={data.current_password} onChange={(v) => setData('current_password', v)} error={errors.current_password} autoComplete="current-password" />
                <Field label="New password" type="password" value={data.password} onChange={(v) => setData('password', v)} error={errors.password} autoComplete="new-password" />
                <Field label="Confirm new password" type="password" value={data.password_confirmation} onChange={(v) => setData('password_confirmation', v)} error={errors.password_confirmation} autoComplete="new-password" />

                <div className="flex items-center gap-2 pt-1">
                    <button
                        type="submit"
                        disabled={processing}
                        className="bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {processing ? 'Saving…' : 'Update password'}
                    </button>
                    {recentlySuccessful && <span className="text-emerald-400 text-xs">Saved.</span>}
                </div>
            </form>
        </Section>
    );
}

function DeleteAccountForm() {
    const [open, setOpen] = useState(false);
    const { data, setData, delete: destroy, errors, processing, reset } = useForm({ password: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onError: () => reset('password'),
            onFinish: () => reset(),
        });
    };

    return (
        <Section title="Danger zone">
            <p className="text-xs text-slate-400 leading-relaxed">
                Permanently delete your account and all associated data. Calls, messages, and contacts on this user will be removed.
            </p>
            {!open ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="mt-3 bg-rose-600/20 border border-rose-400/40 text-rose-200 rounded-xl px-4 py-2 text-sm font-semibold active:bg-rose-600/30"
                >
                    Delete account
                </button>
            ) : (
                <form onSubmit={submit} className="mt-3 space-y-3">
                    <Field label="Confirm with your password" type="password" value={data.password} onChange={(v) => setData('password', v)} error={errors.password} autoComplete="current-password" />
                    <div className="flex items-center gap-2">
                        <button
                            type="submit"
                            disabled={processing || !data.password}
                            className="bg-rose-600 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 active:bg-rose-700"
                        >
                            {processing ? 'Deleting…' : 'Yes, delete'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setOpen(false); reset(); }}
                            className="bg-white/5 border border-white/10 text-slate-300 rounded-xl px-4 py-2 text-sm active:bg-white/10"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </Section>
    );
}
