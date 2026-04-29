import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface Member {
    id: number;
    name: string;
    email: string;
    presence: 'available' | 'busy' | 'away' | 'offline' | null;
    lastSeenAt: string | null;
    roles: string[];
    directPermissions: string[];
    rolePermissions: string[];
    isMe: boolean;
}
interface Invite {
    id: number;
    email: string;
    roleId: number | null;
    invitedBy: string | null;
    acceptUrl: string;
    expiresAt: string | null;
    createdAt: string;
}
interface Role { id: number; name: string; permissions: string[] }
interface Permission { id: number; name: string }

export default function Team() {
    const [members, setMembers] = useState<Member[]>([]);
    const [invites, setInvites] = useState<Invite[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);

    const [email, setEmail] = useState('');
    const [roleId, setRoleId] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

    const [editingMember, setEditingMember] = useState<Member | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await axios.get('/api/team');
            setMembers(r.data.users);
            setInvites(r.data.invites);
            setRoles(r.data.roles);
            setPermissions(r.data.permissions);
            if (!roleId && r.data.roles.length > 0) {
                const agent = (r.data.roles as Role[]).find((x) => x.name === 'agent') ?? r.data.roles[0];
                setRoleId(agent.id);
            }
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const sendInvite = async () => {
        if (!email.trim() || !roleId) return;
        setBusy(true); setError(null); setLastInviteUrl(null);
        try {
            const r = await axios.post('/api/team/invites', { email: email.trim(), role_id: roleId });
            setLastInviteUrl(r.data.invite.acceptUrl);
            setEmail('');
            load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Failed to invite');
        } finally { setBusy(false); }
    };

    const revoke = async (id: number) => {
        if (!confirm('Revoke this invite?')) return;
        await axios.delete(`/api/team/invites/${id}`);
        load();
    };

    const setRole = async (userId: number, role: string) => {
        try {
            await axios.put(`/api/team/${userId}/role`, { role });
            load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message ?? 'Failed to set role');
        }
    };

    const remove = async (userId: number) => {
        if (!confirm('Remove this user?')) return;
        try {
            await axios.delete(`/api/team/${userId}`);
            load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message ?? 'Failed to remove');
        }
    };

    const presenceDot = (p: string | null) => {
        const map: Record<string, string> = {
            available: 'bg-emerald-500',
            busy: 'bg-amber-500',
            away: 'bg-slate-400',
            offline: 'bg-slate-600',
        };
        return map[p ?? 'offline'] ?? 'bg-slate-600';
    };

    return (
        <AppFrame title="Team" back={route('settings.index')}>
            <Head title="Team" />

            <Section title="Invite a teammate">
                <div className="flex flex-col gap-2">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="agent@example.com"
                        className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    <div className="flex gap-2">
                        <select
                            aria-label="Role"
                            value={roleId ?? ''}
                            onChange={(e) => setRoleId(Number(e.target.value))}
                            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                        >
                            {roles.map((r) => (
                                <option key={r.id} value={r.id} className="bg-slate-800">{r.name}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={sendInvite}
                            disabled={busy || !email || !roleId}
                            className="bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                        >
                            {busy ? 'Sending…' : 'Invite'}
                        </button>
                    </div>
                    {error && <div className="text-rose-400 text-xs">{error}</div>}
                    {lastInviteUrl && (
                        <div className="text-xs text-emerald-300 break-all">
                            Invite sent. If your mailer is in dev mode, share this link manually:<br />
                            <span className="font-mono text-slate-300">{lastInviteUrl}</span>
                        </div>
                    )}
                </div>
            </Section>

            {invites.length > 0 && (
                <Section title="Pending invites">
                    <div className="divide-y divide-white/10">
                        {invites.map((i) => (
                            <div key={i.id} className="py-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-sm text-white truncate">{i.email}</div>
                                    <div className="text-[10px] text-slate-500 break-all font-mono">{i.acceptUrl}</div>
                                </div>
                                <button type="button" onClick={() => revoke(i.id)} className="text-xs text-rose-300 px-2 py-1 active:opacity-70 shrink-0">Revoke</button>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            <Section title="Team members">
                {loading && <div className="text-slate-400 text-sm py-3 text-center">Loading…</div>}
                <div className="divide-y divide-white/10">
                    {members.map((m) => (
                        <div key={m.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                            <span className={`w-2.5 h-2.5 rounded-full ${presenceDot(m.presence)}`} title={m.presence ?? 'offline'} />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">
                                    {m.name} {m.isMe && <span className="text-[10px] text-slate-400">(you)</span>}
                                </div>
                                <div className="text-xs text-slate-400 truncate">{m.email}</div>
                                {(m.directPermissions.length > 0) && (
                                    <div className="text-[10px] text-blue-300 mt-0.5 truncate" title={m.directPermissions.join(', ')}>
                                        +{m.directPermissions.length} extra perm{m.directPermissions.length > 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>
                            <select
                                aria-label={`Role for ${m.name}`}
                                value={m.roles[0] ?? 'agent'}
                                disabled={m.isMe}
                                onChange={(e) => setRole(m.id, e.target.value)}
                                className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-white text-xs disabled:opacity-50"
                            >
                                {roles.map((r) => (
                                    <option key={r.id} value={r.name} className="bg-slate-800">{r.name}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setEditingMember(m)}
                                className="text-xs text-sky-300 px-2 py-1 active:opacity-70 shrink-0"
                            >
                                Permissions
                            </button>
                            {!m.isMe && (
                                <button type="button" onClick={() => remove(m.id)} className="text-xs text-rose-300 px-2 py-1 active:opacity-70 shrink-0">Remove</button>
                            )}
                        </div>
                    ))}
                </div>
            </Section>

            {editingMember && (
                <PermissionsEditor
                    member={editingMember}
                    permissions={permissions}
                    onClose={() => setEditingMember(null)}
                    onSaved={(updated) => {
                        setMembers((prev) => prev.map((m) => m.id === updated.id ? updated : m));
                        setEditingMember(null);
                    }}
                />
            )}
        </AppFrame>
    );
}

function PermissionsEditor({
    member,
    permissions,
    onClose,
    onSaved,
}: {
    member: Member;
    permissions: Permission[];
    onClose: () => void;
    onSaved: (updated: Member) => void;
}) {
    const [direct, setDirect] = useState<string[]>(member.directPermissions);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const roleSet = useMemo(() => new Set(member.rolePermissions), [member.rolePermissions]);

    const toggle = (name: string) => {
        if (roleSet.has(name)) return; // role-derived, locked
        setDirect((prev) => prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]);
    };

    const save = async () => {
        setBusy(true); setError(null);
        try {
            const r = await axios.put(`/api/team/${member.id}/permissions`, { permissions: direct });
            onSaved({ ...member, directPermissions: r.data.directPermissions });
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Failed to save');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-2">
            <div className="w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-white/10 max-h-[80vh] flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
                    <div>
                        <div className="text-sm font-semibold text-white">{member.name}</div>
                        <div className="text-[10px] text-slate-400">Role: {member.roles[0] ?? 'agent'} · {direct.length} extra</div>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 active:text-white text-2xl leading-none w-8 h-8" aria-label="Close">×</button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 no-scrollbar">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">
                        Role permissions are locked. Toggle direct grants below.
                    </div>
                    <div className="space-y-1">
                        {permissions.map((p) => {
                            const fromRole = roleSet.has(p.name);
                            const granted = fromRole || direct.includes(p.name);
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => toggle(p.name)}
                                    disabled={fromRole}
                                    className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg ${granted ? 'bg-emerald-500/10' : 'bg-white/5'} ${fromRole ? 'opacity-60 cursor-not-allowed' : 'active:bg-white/10'}`}
                                >
                                    <span className={`w-4 h-4 rounded border ${granted ? 'bg-emerald-500 border-emerald-400' : 'border-white/30'} flex items-center justify-center text-white text-[10px] shrink-0`}>
                                        {granted && '✓'}
                                    </span>
                                    <span className="flex-1 text-sm text-white font-mono truncate">{p.name}</span>
                                    {fromRole && (
                                        <span className="text-[9px] uppercase tracking-wide text-slate-400 shrink-0">via role</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {error && <div className="px-4 py-2 text-rose-400 text-xs shrink-0">{error}</div>}
                <div className="px-4 py-3 border-t border-white/10 flex gap-2 shrink-0">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white/5 text-white text-sm py-2 active:bg-white/10">Cancel</button>
                    <button type="button" onClick={save} disabled={busy} className="flex-1 rounded-xl bg-blue-500 text-white text-sm font-semibold py-2 active:bg-blue-600 disabled:opacity-50">
                        {busy ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
    </section>
);
