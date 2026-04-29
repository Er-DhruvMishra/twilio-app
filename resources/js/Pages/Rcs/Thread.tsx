import ChannelThread from '@/Components/Conversations/ChannelThread';

export default function RcsThread({ conversationId }: { conversationId: number }) {
    return <ChannelThread conversationId={conversationId} threadsRoute="rcs.threads" />;
}
