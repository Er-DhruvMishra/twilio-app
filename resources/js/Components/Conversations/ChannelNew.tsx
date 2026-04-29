import AppFrame from '@/Layouts/AppFrame';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';
import { Channel } from './ChannelApp';

interface Props {
    channel: Channel;
    title: string;
    threadsRoute: string;
    threadRoute: string;
    /** Label for the destination input (e.g. "Recipient WhatsApp number"). */
    destinationLabel: string;
    /** Placeholder for the destination input. */
    destinationPlaceholder: string;
    /**
     * Field name to send. 'identity' for chat (web user); 'address' for the
     * other three channels (binds to channel-specific transport).
     */
    destinationKind: 'identity' | 'address';
    /** Hint shown under the input (e.g. WhatsApp template requirement). */
    hint?: React.ReactNode;
}

export default function ChannelNew({
    channel, title, threadsRoute, threadRoute,
    destinationLabel, destinationPlaceholder, destinationKind, hint,
}: Props) {
    const [destination, setDestination] = useState('');
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const create = async () => {
        if (!destination.trim()) return;
        setBusy(true); setError(null);
        try {
            const payload: Record<string, string> = {
                channel,
                friendly_name: name.trim() || destination.trim(),
            };
            if (destinationKind === 'identity') payload.participant_identity = destination.trim();
            else payload.participant_address = destination.trim();

            const r = await axios.post('/api/conversations', payload);
            router.visit(route(threadRoute, r.data.conversation.id));
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message ?? 'Failed to create conversation');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppFrame title={title} back={route(threadsRoute)}>
            <Head title={title} />

            <div className="space-y-3">
                <Field label={destinationLabel} placeholder={destinationPlaceholder} value={destination} onChange={setDestination} mono />
                {hint && <div className="text-[11px] text-slate-400 leading-relaxed">{hint}</div>}
                <Field label="Conversation name (optional)" placeholder="Friendly title" value={name} onChange={setName} />

                {error && <div className="text-rose-400 text-sm">{error}</div>}

                <button
                    type="button"
                    onClick={create}
                    disabled={busy || !destination.trim()}
                    className="w-full bg-blue-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:bg-blue-600"
                >
                    {busy ? 'Creating…' : 'Start conversation'}
                </button>
            </div>
        </AppFrame>
    );
}

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
    return (
        <label className="block">
            <div className="text-xs text-slate-300 mb-1">{label}</div>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 ${mono ? 'font-mono text-sm' : 'text-sm'}`}
            />
        </label>
    );
}
