import ChannelThreadsView from '@/Components/Conversations/ChannelApp';

export default function RcsThreads() {
    return (
        <ChannelThreadsView
            channel="rcs"
            title="RCS"
            threadsRoute="rcs.threads"
            threadRoute="rcs.thread"
            newRoute="rcs.new"
            banner={
                <div className="mb-3 rounded-xl bg-amber-500/10 border border-amber-400/30 p-2.5 text-amber-200 text-xs">
                    RCS is delivered to RCS-capable Android devices via Google Messages. iOS and non-RCS devices fall back to SMS.
                </div>
            }
        />
    );
}
