import ChannelThreadsView from '@/Components/Conversations/ChannelApp';

export default function ChatThreads() {
    return (
        <ChannelThreadsView
            channel="chat"
            title="Chat"
            threadsRoute="chat.threads"
            threadRoute="chat.thread"
            newRoute="chat.new"
        />
    );
}
