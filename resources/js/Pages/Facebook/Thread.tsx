import ChannelThread from '@/Components/Conversations/ChannelThread';

export default function FacebookThread({ conversationId }: { conversationId: number }) {
    return <ChannelThread conversationId={conversationId} threadsRoute="facebook.threads" />;
}
