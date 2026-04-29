import ChannelNew from '@/Components/Conversations/ChannelNew';

export default function RcsNew() {
    return (
        <ChannelNew
            channel="rcs"
            title="New RCS chat"
            threadsRoute="rcs.threads"
            threadRoute="rcs.thread"
            destinationLabel="Recipient phone number"
            destinationPlaceholder="rbm:+14155551212"
            destinationKind="address"
            hint="Use rbm:+E.164 format. The recipient must have RCS enabled in Google Messages."
        />
    );
}
