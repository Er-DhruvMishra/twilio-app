import ChannelNew from '@/Components/Conversations/ChannelNew';

export default function FacebookNew() {
    return (
        <ChannelNew
            channel="facebook"
            title="New Messenger chat"
            threadsRoute="facebook.threads"
            threadRoute="facebook.thread"
            destinationLabel="Recipient PSID"
            destinationPlaceholder="messenger:1234567890"
            destinationKind="address"
            hint="Page-Scoped User ID (PSID) is captured when a user first messages your Facebook Page. Outbound is constrained by Meta's messaging policy."
        />
    );
}
