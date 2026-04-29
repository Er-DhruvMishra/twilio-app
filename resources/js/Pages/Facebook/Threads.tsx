import ChannelThreadsView from '@/Components/Conversations/ChannelApp';

export default function FacebookThreads() {
    return (
        <ChannelThreadsView
            channel="facebook"
            title="Messenger"
            threadsRoute="facebook.threads"
            threadRoute="facebook.thread"
            newRoute="facebook.new"
            banner={
                <div className="mb-3 rounded-xl bg-blue-500/10 border border-blue-400/30 p-2.5 text-blue-200 text-xs">
                    Facebook Messenger conversations are typically initiated by the user from your Page. Outbound messages must comply with Meta's 24h messaging window + tags.
                </div>
            }
        />
    );
}
