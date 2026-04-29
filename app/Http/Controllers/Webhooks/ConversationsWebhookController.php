<?php

namespace App\Http\Controllers\Webhooks;

use App\Events\ConversationMessageReceived;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Models\ConversationParticipant;
use App\Models\User;
use App\Notifications\ConversationMessageNotification;
use App\Services\Debug\DebugLogger;
use Illuminate\Http\Request;

/**
 * Single webhook for ALL Conversations events across all 4 channels.
 * Twilio sends `EventType` ∈ onMessageAdded / onParticipantAdded /
 * onConversationStateUpdated / onDeliveryUpdated / onParticipantRemoved /
 * onConversationAdded.
 *
 * Idempotency by twilio_message_sid / twilio_participant_sid UNIQUE.
 */
class ConversationsWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $event = (string) $request->input('EventType', '');

        DebugLogger::log('webhooks', 'POST /webhooks/twilio/conversations', $request->all());
        DebugLogger::log('conversations', "webhook · {$event}", $request->all());

        match ($event) {
            'onMessageAdded' => $this->onMessageAdded($request),
            'onParticipantAdded' => $this->onParticipantAdded($request),
            'onParticipantRemoved' => $this->onParticipantRemoved($request),
            'onConversationStateUpdated' => $this->onStateUpdated($request),
            'onConversationAdded' => $this->onConversationAdded($request),
            'onDeliveryUpdated' => $this->onDeliveryUpdated($request),
            default => null,
        };

        return response('ok');
    }

    private function onMessageAdded(Request $r): void
    {
        $convSid = (string) $r->input('ConversationSid', '');
        $msgSid = (string) $r->input('MessageSid', '');
        if (!$convSid || !$msgSid) return;

        $conv = Conversation::where('twilio_conversation_sid', $convSid)->first();
        if (!$conv) return;

        $authorIdentity = (string) $r->input('Author', '');
        $authorUserId = \App\Services\Twilio\AccessTokenService::userIdFromIdentity($authorIdentity);

        $msg = ConversationMessage::firstOrCreate(
            ['twilio_message_sid' => $msgSid],
            [
                'conversation_id' => $conv->id,
                'twilio_index' => (int) $r->input('Index', 0),
                'author_identity' => $authorIdentity,
                'author_user_id' => $authorUserId,
                'body' => $r->input('Body'),
                'num_media' => (int) $r->input('NumMedia', 0),
                'delivery_status' => 'sent',
                'sent_at' => now(),
            ],
        );

        $conv->update([
            'last_message_at' => now(),
            'last_message_index' => (int) $r->input('Index', $conv->last_message_index),
            'unread_count_for_owner' => $authorUserId === $conv->owner_user_id
                ? $conv->unread_count_for_owner
                : ($conv->unread_count_for_owner + 1),
        ]);

        // Skip self-echo: when WE created the message via API the firstOrCreate
        // returns the existing row but the dispatch is unnecessary — the
        // sender's UI already has it.
        if ($msg->wasRecentlyCreated && $authorUserId !== $conv->owner_user_id) {
            $fresh = $conv->fresh();
            ConversationMessageReceived::dispatch($fresh, $msg);

            $owner = $conv->owner_user_id ? User::find($conv->owner_user_id) : null;
            if ($owner) {
                dispatch(function () use ($owner, $fresh, $msg) {
                    $owner->notify(new ConversationMessageNotification($fresh, $msg));
                })->afterResponse();
            }
        }
    }

    private function onParticipantAdded(Request $r): void
    {
        $convSid = (string) $r->input('ConversationSid', '');
        $partSid = (string) $r->input('ParticipantSid', '');
        if (!$convSid || !$partSid) return;

        $conv = Conversation::where('twilio_conversation_sid', $convSid)->first();
        if (!$conv) return;

        ConversationParticipant::firstOrCreate(
            ['twilio_participant_sid' => $partSid],
            [
                'conversation_id' => $conv->id,
                'identity' => $r->input('Identity'),
                'channel_address' => $r->input('MessagingBinding.Address'),
                'role' => 'participant',
                'joined_at' => now(),
            ],
        );
    }

    private function onParticipantRemoved(Request $r): void
    {
        $partSid = (string) $r->input('ParticipantSid', '');
        ConversationParticipant::where('twilio_participant_sid', $partSid)->update(['left_at' => now()]);
    }

    private function onStateUpdated(Request $r): void
    {
        $convSid = (string) $r->input('ConversationSid', '');
        $state = (string) $r->input('State', '');
        Conversation::where('twilio_conversation_sid', $convSid)
            ->update(['state' => in_array($state, ['active', 'inactive', 'closed'], true) ? $state : 'active']);
    }

    private function onConversationAdded(Request $r): void
    {
        // We typically create conversations server-side, but external
        // participants (e.g. inbound WhatsApp) auto-create one. Best-effort
        // capture so we have the row before the first onMessageAdded fires.
        $convSid = (string) $r->input('ConversationSid', '');
        if (!$convSid) return;
        if (Conversation::where('twilio_conversation_sid', $convSid)->exists()) return;

        // We don't know the channel from the event alone; default to chat
        // and let UI/admin reassign.
        Conversation::create([
            'twilio_conversation_sid' => $convSid,
            'channel' => 'chat',
            'friendly_name' => $r->input('FriendlyName'),
            'state' => 'active',
        ]);
    }

    private function onDeliveryUpdated(Request $r): void
    {
        $msgSid = (string) $r->input('MessageSid', '');
        $status = (string) $r->input('Status', '');
        if (!$msgSid || !$status) return;

        ConversationMessage::where('twilio_message_sid', $msgSid)
            ->update(['delivery_status' => match ($status) {
                'queued' => 'queued',
                'sent' => 'sent',
                'delivered' => 'delivered',
                'read' => 'read',
                'failed', 'undelivered' => 'failed',
                default => 'sent',
            }]);
    }
}
