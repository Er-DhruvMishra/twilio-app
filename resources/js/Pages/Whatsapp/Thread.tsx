import ChannelThread from '@/Components/Conversations/ChannelThread';

export default function WhatsappThread({ conversationId }: { conversationId: number }) {
    return <ChannelThread conversationId={conversationId} threadsRoute="whatsapp.threads" />;
}
