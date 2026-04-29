import { router } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';
import { useDeviceOptional } from '@/Components/TwilioDeviceProvider';

interface Props {
    /** E.164 number for the peer of this row (caller for inbound, callee for outbound). */
    phone: string | null;
    /** True when this peer already exists in contacts — hides the Save button. */
    hasContact: boolean;
    /**
     * Display label suggested when opening the Save sheet (e.g. caller_name
     * from CNAM, or just the phone). User can edit before saving.
     */
    suggestedName?: string | null;
    /** Fired after a successful save so the parent can refresh the list. */
    onSaved?: (contactId: number) => void;
    /** Compact variant — icon-only, no labels. Default true. */
    compact?: boolean;
}

/**
 * Tiny action cluster used on rows in History / Voicemail / Messages /
 * Conversation lists. Renders Call + SMS always, and a Save button only
 * when the peer isn't already a contact.
 */
export default function RowActions({ phone, hasContact, suggestedName, onSaved, compact = true }: Props) {
    const device = useDeviceOptional();
    const [saveOpen, setSaveOpen] = useState(false);

    if (!phone || !phone.startsWith('+')) return null;

    const dial = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!device) return;
        device.dial(phone).catch(() => { /* surfaced on dialer */ });
    };

    const sms = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.visit(`/messages/compose?to=${encodeURIComponent(phone)}`);
    };

    const openSave = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSaveOpen(true);
    };

    return (
        <>
            <div className={`flex items-center gap-1 shrink-0 ${compact ? '' : 'gap-2'}`} onClick={(e) => e.stopPropagation()}>
                <ActionBtn label="Call" onClick={dial}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                        <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.05-.24c1.12.39 2.33.6 3.54.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.21.21 2.42.6 3.54a1 1 0 0 1-.24 1.05l-2.24 2.2z" />
                    </svg>
                </ActionBtn>
                <ActionBtn label="Message" onClick={sms} tone="sky">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </ActionBtn>
                {!hasContact && (
                    <ActionBtn label="Save contact" onClick={openSave} tone="amber">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <line x1="19" y1="8" x2="19" y2="14" />
                            <line x1="16" y1="11" x2="22" y2="11" />
                        </svg>
                    </ActionBtn>
                )}
            </div>

            {saveOpen && (
                <SaveContactSheet
                    phone={phone}
                    suggestedName={suggestedName ?? phone}
                    onClose={() => setSaveOpen(false)}
                    onSaved={(id) => { setSaveOpen(false); onSaved?.(id); }}
                />
            )}
        </>
    );
}

function ActionBtn({ label, onClick, children, tone = 'emerald' }: {
    label: string;
    onClick: (e: React.MouseEvent) => void;
    children: React.ReactNode;
    tone?: 'emerald' | 'sky' | 'amber';
}) {
    const tones: Record<string, string> = {
        emerald: 'text-emerald-300',
        sky: 'text-sky-300',
        amber: 'text-amber-300',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={`w-7 h-7 rounded-full bg-white/5 active:bg-white/15 flex items-center justify-center ${tones[tone]}`}
        >
            {children}
        </button>
    );
}

function SaveContactSheet({
    phone,
    suggestedName,
    onClose,
    onSaved,
}: {
    phone: string;
    suggestedName: string;
    onClose: () => void;
    onSaved: (id: number) => void;
}) {
    const [name, setName] = useState(suggestedName);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        if (!name.trim()) return;
        setBusy(true); setError(null);
        try {
            const r = await axios.post('/api/contacts/quick-save', {
                display_name: name.trim(),
                phone,
            });
            onSaved(r.data.contact.id);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            const msg = err.response?.data?.errors
                ? Object.values(err.response.data.errors).flat().join(' ')
                : err.response?.data?.message;
            setError(msg ?? 'Save failed');
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
            <div
                className="w-full sm:max-w-sm bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-white/10 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold text-white">Save contact</div>
                <div className="px-4 py-3 space-y-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Phone</div>
                        <div className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 font-mono">{phone}</div>
                    </div>
                    <label className="block">
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Name</div>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && save()}
                        />
                    </label>
                    {error && <div className="text-rose-400 text-xs">{error}</div>}
                </div>
                <div className="px-4 py-3 border-t border-white/10 flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white/5 text-white text-sm py-2 active:bg-white/10">Cancel</button>
                    <button type="button" onClick={save} disabled={busy || !name.trim()} className="flex-1 rounded-xl bg-blue-500 text-white text-sm font-semibold py-2 active:bg-blue-600 disabled:opacity-50">
                        {busy ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
