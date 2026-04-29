import AppFrame from '@/Layouts/AppFrame';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePrivateChannel } from '@/Hooks/useEcho';

interface Room {
    id: number;
    twilioSid: string;
    name: string;
    type: string;
    status: 'in-progress' | 'completed' | 'failed';
    maxParticipants: number;
    recordParticipants: boolean;
    startedAt: string | null;
    creator: { id: number; name: string } | null;
    participants: Array<{ identity: string; joinedAt: string | null; leftAt: string | null }> | null;
}

export default function VideoIndex() {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = (auth.user?.roles ?? []).includes('admin');
    const canManage = (auth.user?.permissions ?? []).includes('manage-video-rooms');

    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    const [name, setName] = useState('');
    const [type, setType] = useState('group');
    const [record, setRecord] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        try {
            const r = await axios.get('/api/video/rooms');
            setRooms(r.data.rooms);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    usePrivateChannel(auth.user ? `user.${auth.user.id}` : null, {
        '.VideoRoomEvent': () => load(),
    });

    const create = async () => {
        if (!name.trim()) return;
        setBusy(true);
        try {
            const r = await axios.post('/api/video/rooms', {
                name: name.trim(),
                type,
                record_participants: record,
            });
            router.visit(route('video.room', r.data.room.id));
        } finally { setBusy(false); }
    };

    return (
        <AppFrame
            title="Video"
            back={route('home')}
            actions={<Link href={route('video.recordings')} className="text-sky-400 text-sm font-semibold px-2 py-1 active:opacity-60">Recordings</Link>}
        >
            <Head title="Video" />

            <Section title="Create room">
                <div className="space-y-2">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Room name"
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    <div className="flex gap-2">
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-white text-xs"
                            aria-label="Room type"
                        >
                            <option value="group" className="bg-slate-800">Group (≤50)</option>
                            <option value="group-small" className="bg-slate-800">Small group (≤4)</option>
                            <option value="peer-to-peer" className="bg-slate-800">Peer-to-peer (≤2)</option>
                            <option value="go" className="bg-slate-800">Go — free tier (≤2)</option>
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300">
                            <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} className="rounded text-blue-500 bg-white/5 border-white/20" />
                            Record
                        </label>
                    </div>
                    <button
                        type="button"
                        onClick={create}
                        disabled={busy || !name.trim()}
                        className="w-full bg-blue-500 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50 active:bg-blue-600"
                    >
                        {busy ? 'Creating…' : 'Create + join'}
                    </button>
                    {record && <div className="text-[10px] text-amber-300">Recording adds ~$0.0015/min/track + composition cost.</div>}
                </div>
            </Section>

            <Section title="Active rooms">
                {loading && <div className="text-slate-400 text-sm py-3 text-center">Loading…</div>}
                {!loading && rooms.filter((r) => r.status === 'in-progress').length === 0 && (
                    <div className="text-slate-400 text-xs text-center py-3">No active rooms.</div>
                )}
                <div className="divide-y divide-white/10">
                    {rooms.filter((r) => r.status === 'in-progress').map((r) => (
                        <Link key={r.id} href={route('video.room', r.id)} className="block py-2 active:opacity-70">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white truncate">{r.name}</div>
                                    <div className="text-[10px] text-slate-400">
                                        {r.type} · {(r.participants ?? []).filter((p) => !p.leftAt).length}/{r.maxParticipants} live
                                        {r.recordParticipants && <span className="text-amber-300"> · ● rec</span>}
                                    </div>
                                </div>
                                {isAdmin && r.creator && (
                                    <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{r.creator.name}</span>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            </Section>

            <Section title="Recent rooms">
                <div className="divide-y divide-white/10">
                    {rooms.filter((r) => r.status !== 'in-progress').slice(0, 30).map((r) => (
                        <div key={r.id} className="py-2">
                            <div className="text-sm text-slate-300 truncate">{r.name}</div>
                            <div className="text-[10px] text-slate-500">
                                {r.type} · {r.status} · {r.startedAt ? new Date(r.startedAt).toLocaleString() : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </Section>
        </AppFrame>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 px-1 mb-2">{title}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">{children}</div>
    </section>
);
