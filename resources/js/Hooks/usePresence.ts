import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePresenceChannel } from '@/Hooks/useEcho';

export type Presence = 'available' | 'busy' | 'away' | 'offline';

export interface PresenceMember {
    id: number;
    name: string;
    presence: Presence;
}

interface Options { authedUserId?: number; initialPresence?: Presence }

export function usePresence({ authedUserId, initialPresence }: Options) {
    const [me, setMe] = useState<Presence>(initialPresence ?? 'offline');
    const [team, setTeam] = useState<PresenceMember[]>([]);

    usePresenceChannel<PresenceMember>('agents', {
        here: (members) => setTeam(members),
        joining: (m) => setTeam((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]),
        leaving: (m) => setTeam((prev) => prev.filter((x) => x.id !== m.id)),
    });

    // Heartbeat every 60s while the tab is visible.
    useEffect(() => {
        if (!authedUserId) return;
        const tick = () => { if (!document.hidden) axios.post('/api/agents/heartbeat').catch(() => {}); };
        const id = setInterval(tick, 60_000);
        tick();
        return () => clearInterval(id);
    }, [authedUserId]);

    // Set 'available' on focus, 'away' on long blur.
    useEffect(() => {
        if (!authedUserId) return;
        const onFocus = () => set('available');
        const onBlur = () => { setTimeout(() => { if (document.hidden) set('away'); }, 60_000); };
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
        };
    }, [authedUserId]);

    const set = async (p: Presence) => {
        setMe(p);
        try { await axios.post('/api/agents/presence', { presence: p }); } catch { /* ignore */ }
    };

    return { me, set, team };
}
