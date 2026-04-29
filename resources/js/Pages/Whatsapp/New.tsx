import ChannelNew from '@/Components/Conversations/ChannelNew';

export default function WhatsappNew() {
    return (
        <ChannelNew
            channel="whatsapp"
            title="New WhatsApp chat"
            threadsRoute="whatsapp.threads"
            threadRoute="whatsapp.thread"
            destinationLabel="Recipient WhatsApp number"
            destinationPlaceholder="+14155551212"
            destinationKind="address"
            hint="Use +E.164 format. First message outside the 24h window must be a pre-approved template."
        />
    );
}
