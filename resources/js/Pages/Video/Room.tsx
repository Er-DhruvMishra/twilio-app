import AppFrame from '@/Layouts/AppFrame';
import { Head, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

interface RoomDetail {
    id: number;
    twilioSid: string;
    name: string;
    type: string;
    status: string;
    maxParticipants: number;
    recordParticipants: boolean;
    participants: Array<{ id: number; twilioSid: string; identity: string; role: string; joinedAt: string | null; leftAt: string | null }> | null;
}

// twilio-video has complex generic types — using `any` here is the documented
// pattern in their own examples since track/participant types are runtime-driven.
/* eslint-disable @typescript-eslint/no-explicit-any */

export default function VideoRoom({ roomId }: { roomId: number }) {
    const { auth } = usePage<PageProps>().props;
    const canManage = (auth.user?.permissions ?? []).includes('manage-video-rooms');

    const [room, setRoom] = useState<RoomDetail | null>(null);
    const [connected, setConnected] = useState(false);
    const [muted, setMuted] = useState(false);
    const [camOff, setCamOff] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const localRef = useRef<HTMLDivElement | null>(null);
    const remotesRef = useRef<HTMLDivElement | null>(null);
    const roomRef = useRef<any>(null);

    const load = async () => {
        const r = await axios.get(`/api/video/rooms/${roomId}`);
        setRoom(r.data.room);
    };

    useEffect(() => { load(); }, [roomId]);

    const attachRemote = (participant: any) => {
        const tile = document.createElement('div');
        tile.className = 'rounded-xl bg-slate-800 overflow-hidden relative aspect-video';
        tile.dataset.sid = participant.sid;
        const label = document.createElement('div');
        label.className = 'absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded';
        label.textContent = participant.identity;
        tile.appendChild(label);
        remotesRef.current?.appendChild(tile);

        participant.tracks.forEach((pub: any) => {
            if (pub.track) tile.appendChild(pub.track.attach());
        });
        participant.on('trackSubscribed', (track: any) => { tile.appendChild(track.attach()); });
    };

    const detachRemote = (participant: any) => {
        remotesRef.current?.querySelector(`[data-sid="${participant.sid}"]`)?.remove();
    };

    const connect = async () => {
        setError(null);
        try {
            const tk = await axios.post(`/api/video/rooms/${roomId}/token`);
            const Video: any = await import('twilio-video');
            const twRoom = await Video.connect(tk.data.token, {
                name: tk.data.roomName,
                audio: true,
                video: { width: 640 },
            });
            roomRef.current = twRoom;
            setConnected(true);

            twRoom.localParticipant.tracks.forEach((pub: any) => {
                if (pub.track) localRef.current?.appendChild(pub.track.attach());
            });

            twRoom.participants.forEach(attachRemote);
            twRoom.on('participantConnected', attachRemote);
            twRoom.on('participantDisconnected', detachRemote);
            twRoom.on('disconnected', () => { setConnected(false); roomRef.current = null; });
        } catch (e: unknown) {
            const err = e as Error;
            setError(err.message ?? 'Failed to join room');
        }
    };

    const leave = () => {
        roomRef.current?.disconnect();
        setConnected(false);
        router.visit(route('video.index'));
    };

    const toggleMute = () => {
        roomRef.current?.localParticipant.audioTracks.forEach((pub: any) => pub.track.enable(!pub.track.isEnabled));
        setMuted((m) => !m);
    };

    const toggleCam = () => {
        roomRef.current?.localParticipant.videoTracks.forEach((pub: any) => pub.track.enable(!pub.track.isEnabled));
        setCamOff((c) => !c);
    };

    const endRoom = async () => {
        if (!confirm('End the room for everyone?')) return;
        await axios.post(`/api/video/rooms/${roomId}/end`);
        leave();
    };

    return (
        <AppFrame title={room?.name ?? 'Room'} back={route('video.index')}>
            <Head title={room?.name ?? 'Video room'} />

            {error && <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3 text-rose-300 text-sm mb-3">{error}</div>}

            {!connected ? (
                <div className="text-center py-6">
                    <div className="text-slate-300 text-sm mb-2">Ready to join {room?.name ?? '…'}</div>
                    {room?.recordParticipants && <div className="text-amber-300 text-xs mb-3">This room is being recorded.</div>}
                    <button
                        type="button"
                        onClick={connect}
                        className="bg-emerald-500 text-white rounded-xl px-6 py-3 font-semibold active:bg-emerald-600"
                    >
                        Join room
                    </button>
                </div>
            ) : (
                <>
                    <div ref={remotesRef} className="grid grid-cols-2 gap-2 mb-2 max-h-[55vh] overflow-y-auto" />
                    <div ref={localRef} className="rounded-xl bg-slate-900 border border-white/10 aspect-video w-32 ml-auto mb-3 overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />
                    <div className="flex items-center justify-around gap-2">
                        <CtrlBtn label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute} active={!muted} />
                        <CtrlBtn label={camOff ? 'Cam on' : 'Cam off'} onClick={toggleCam} active={!camOff} />
                        <CtrlBtn label="Leave" onClick={leave} variant="danger" />
                        {canManage && <CtrlBtn label="End room" onClick={endRoom} variant="danger" />}
                    </div>
                </>
            )}
        </AppFrame>
    );
}

function CtrlBtn({ label, onClick, active, variant }: { label: string; onClick: () => void; active?: boolean; variant?: 'danger' }) {
    const base = 'px-3 py-2 rounded-full text-xs font-semibold active:opacity-80';
    const cls = variant === 'danger'
        ? `${base} bg-rose-500 text-white`
        : active === false
            ? `${base} bg-slate-700 text-white`
            : `${base} bg-white/10 text-white`;
    return <button type="button" onClick={onClick} className={cls}>{label}</button>;
}
