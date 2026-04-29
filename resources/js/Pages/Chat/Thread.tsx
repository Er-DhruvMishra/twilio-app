import ChannelThread from '@/Components/Conversations/ChannelThread';

export default function ChatThread({ conversationId }: { conversationId: number }) {
    return <ChannelThread conversationId={conversationId} threadsRoute="chat.threads" />;
}
