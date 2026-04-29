<?php

namespace App\Services\Twilio;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\ConversationsConfig;
use App\Models\TwilioConfig;
use App\Models\User;
use App\Services\Debug\DebugLogger;

/**
 * Twilio Conversations API wrapper. One service hosts all four channels —
 * Chat (web↔web identity), RCS, WhatsApp, Facebook Messenger — distinguished
 * by `channel` parameter and `proxy_address` / `messaging-binding` shape.
 *
 * Twilio Programmable Chat (the older API) was End-of-Life on 2022-07-25;
 * everything funnels through Conversations now, even the Chat-only flow.
 */
class ConversationsService
{
    public const CHANNELS = ['chat', 'rcs', 'whatsapp', 'facebook'];

    public function __construct(private TwilioClientFactory $factory) {}

    /**
     * Create a conversation. `channel` ∈ self::CHANNELS.
     * Returns the persisted local Conversation row.
     */
    public function createConversation(User $owner, string $channel, string $friendlyName, array $proxyConfig = []): Conversation
    {
        if (!in_array($channel, self::CHANNELS, true)) {
            throw new \InvalidArgumentException("Unknown channel: {$channel}");
        }

        $serviceSid = $this->serviceSid();
        $client = $this->factory->fromConfig(TwilioConfig::active());

        $createParams = ['friendlyName' => $friendlyName];
        if (!empty($proxyConfig['attributes'])) {
            $createParams['attributes'] = json_encode($proxyConfig['attributes']);
        }

        try {
            $tw = $client->conversations->v1->services($serviceSid)
                ->conversations
                ->create($createParams);
            DebugLogger::trace('conversations', "services({$serviceSid}).conversations.create", [
                'channel' => $channel,
                'params' => $createParams,
                'owner_user_id' => $owner->id,
            ], $tw);
        } catch (\Throwable $e) {
            DebugLogger::trace('conversations', "services({$serviceSid}).conversations.create", [
                'channel' => $channel, 'params' => $createParams,
            ], null, $e);
            throw $e;
        }

        return Conversation::create([
            'twilio_conversation_sid' => $tw->sid,
            'channel' => $channel,
            'friendly_name' => $friendlyName,
            'attributes' => $proxyConfig['attributes'] ?? null,
            'owner_user_id' => $owner->id,
            'state' => 'active',
        ]);
    }

    /**
     * Add a participant. Shape depends on channel:
     *  - chat: identity-based (internal user)
     *  - rcs: messaging-binding.address = `rbm:agent-id`, proxy = RCS agent
     *  - whatsapp: messaging-binding.address = `whatsapp:+E.164`, proxy = `whatsapp:+from`
     *  - facebook: messaging-binding.address = `messenger:psid`, proxy = `messenger:page-id`
     */
    public function addParticipant(Conversation $conv, array $participant): ConversationParticipant
    {
        $serviceSid = $this->serviceSid();
        $client = $this->factory->fromConfig(TwilioConfig::active());
        $config = ConversationsConfig::active();

        $params = [];
        switch ($conv->channel) {
            case 'chat':
                $params['identity'] = $participant['identity'] ?? throw new \InvalidArgumentException('identity required for chat');
                break;
            case 'rcs':
                $params['messagingBindingAddress'] = $participant['address'] ?? throw new \InvalidArgumentException('address required (rbm:...)');
                $params['messagingBindingProxyAddress'] = $config?->rcs_agent_sid;
                break;
            case 'whatsapp':
                $addr = $participant['address'] ?? throw new \InvalidArgumentException('address required (+E.164)');
                $params['messagingBindingAddress'] = str_starts_with($addr, 'whatsapp:') ? $addr : "whatsapp:{$addr}";
                $params['messagingBindingProxyAddress'] = $config?->whatsapp_from
                    ? (str_starts_with($config->whatsapp_from, 'whatsapp:') ? $config->whatsapp_from : "whatsapp:{$config->whatsapp_from}")
                    : null;
                break;
            case 'facebook':
                $psid = $participant['address'] ?? throw new \InvalidArgumentException('PSID required');
                $params['messagingBindingAddress'] = str_starts_with($psid, 'messenger:') ? $psid : "messenger:{$psid}";
                $params['messagingBindingProxyAddress'] = $config?->facebook_page_id
                    ? (str_starts_with($config->facebook_page_id, 'messenger:') ? $config->facebook_page_id : "messenger:{$config->facebook_page_id}")
                    : null;
                break;
        }

        try {
            $tw = $client->conversations->v1->services($serviceSid)
                ->conversations($conv->twilio_conversation_sid)
                ->participants
                ->create(array_filter($params));
            DebugLogger::trace('conversations', "conversations({$conv->twilio_conversation_sid}).participants.create", [
                'channel' => $conv->channel,
                'params' => array_filter($params),
            ], $tw);
        } catch (\Throwable $e) {
            DebugLogger::trace('conversations', "conversations({$conv->twilio_conversation_sid}).participants.create", [
                'channel' => $conv->channel, 'params' => array_filter($params),
            ], null, $e);
            throw $e;
        }

        return ConversationParticipant::create([
            'conversation_id' => $conv->id,
            'twilio_participant_sid' => $tw->sid,
            'user_id' => $participant['user_id'] ?? null,
            'identity' => $params['identity'] ?? null,
            'channel_address' => $params['messagingBindingAddress'] ?? null,
            'role' => $participant['role'] ?? 'participant',
            'joined_at' => now(),
        ]);
    }

    public function sendMessage(Conversation $conv, string $author, string $body, array $mediaSids = []): array
    {
        $serviceSid = $this->serviceSid();
        $client = $this->factory->fromConfig(TwilioConfig::active());

        $params = ['body' => $body, 'author' => $author];
        if (!empty($mediaSids)) {
            $params['mediaSid'] = $mediaSids;
        }

        try {
            $tw = $client->conversations->v1->services($serviceSid)
                ->conversations($conv->twilio_conversation_sid)
                ->messages
                ->create($params);
            DebugLogger::trace('conversations', "conversations({$conv->twilio_conversation_sid}).messages.create", [
                'channel' => $conv->channel,
                'author' => $author,
                'body_length' => strlen($body),
                'media_count' => count($mediaSids),
            ], $tw);
        } catch (\Throwable $e) {
            DebugLogger::trace('conversations', "conversations({$conv->twilio_conversation_sid}).messages.create", [
                'channel' => $conv->channel, 'author' => $author,
            ], null, $e);
            throw $e;
        }

        return [
            'sid' => $tw->sid,
            'index' => (int) ($tw->index ?? 0),
            'date_created' => $tw->dateCreated,
        ];
    }

    public function close(Conversation $conv): void
    {
        $serviceSid = $this->serviceSid();
        $client = $this->factory->fromConfig(TwilioConfig::active());
        $client->conversations->v1->services($serviceSid)
            ->conversations($conv->twilio_conversation_sid)
            ->update(['state' => 'closed']);
        $conv->update(['state' => 'closed']);
    }

    private function serviceSid(): string
    {
        $config = ConversationsConfig::active();
        $sid = $config?->service_sid ?? env('TWILIO_CONVERSATIONS_SERVICE_SID');
        if (!$sid) throw new \RuntimeException('Twilio Conversations service not configured.');
        return $sid;
    }
}
