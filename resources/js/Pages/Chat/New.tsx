import ChannelNew from '@/Components/Conversations/ChannelNew';

export default function ChatNew() {
    return (
        <ChannelNew
            channel="chat"
            title="New chat"
            threadsRoute="chat.threads"
            threadRoute="chat.thread"
            destinationLabel="Recipient identity"
            destinationPlaceholder="user_42"
            destinationKind="identity"
            hint="Use the other user's identity (e.g. user_42 for an internal teammate). Web-to-web only — no SMS bridge."
        />
    );
}
