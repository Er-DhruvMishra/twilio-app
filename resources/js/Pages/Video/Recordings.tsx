import AppFrame from '@/Layouts/AppFrame';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Recording {
    id: number;
    twilio_recording_sid: string;
    twilio_composition_sid: string | null;
    status: string;
    format: string;
    duration_seconds: number;
    size_bytes: number;
    media_url: string | null;
    room: { id: number; name: string; started_at: string | null } | null;
}

export default function VideoRecordings() {
    const [items, setItems] = useState<Recording[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('/api/video/recordings').then((r) => setItems(r.data.recordings)).finally(() => setLoading(false));
    }, []);

    return (
        <AppFrame title="Recordings" back={route('video.index')}>
            <Head title="Recordings" />

            {loading && <div className="text-slate-400 text-sm text-center py-6">Loading…</div>}
            {!loading && items.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-10">No recordings.</div>
            )}

            <div className="divide-y divide-white/10">
                {items.map((r) => (
                    <div key={r.id} className="py-2">
                        <div className="text-sm text-white truncate">{r.room?.name ?? '—'}</div>
                        <div className="text-[10px] text-slate-400">
                            {r.format} · {Math.round(r.duration_seconds / 60)} min · {(r.size_bytes / 1024 / 1024).toFixed(1)} MB · {r.status}
                        </div>
                        {r.media_url && (
                            <a href={r.media_url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 active:opacity-70">
                                Open ↗
                            </a>
                        )}
                    </div>
                ))}
            </div>
        </AppFrame>
    );
}
