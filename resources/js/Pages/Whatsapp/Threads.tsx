import ChannelThreadsView from '@/Components/Conversations/ChannelApp';

export default function WhatsappThreads() {
    return (
        <ChannelThreadsView
            channel="whatsapp"
            title="WhatsApp"
            threadsRoute="whatsapp.threads"
            threadRoute="whatsapp.thread"
            newRoute="whatsapp.new"
            banner={
                <div className="mb-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-2.5 text-emerald-200 text-xs leading-relaxed">
                    WhatsApp Business: outside the 24-hour customer-care window, you can only send pre-approved Message Templates.
                </div>
            }
        />
    );
}
