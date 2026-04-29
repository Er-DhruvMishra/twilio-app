<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Models\ConversationParticipant;
use App\Services\Twilio\ConversationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    /** Map channel → permission name. */
    private const CHANNEL_PERMISSION = [
        'chat' => 'use-chat',
        'rcs' => 'use-rcs',
        'whatsapp' => 'use-whatsapp',
        'facebook' => 'use-facebook',
    ];

    public function __construct(private ConversationsService $service) {}

    private function gateChannel(?string $channel, $user): void
    {
        if ($channel && isset(self::CHANNEL_PERMISSION[$channel])) {
            abort_unless($user->can(self::CHANNEL_PERMISSION[$channel]), 403, "Missing permission: " . self::CHANNEL_PERMISSION[$channel]);
            return;
        }
        // No channel specified → require ANY of the four perms.
        $any = collect(self::CHANNEL_PERMISSION)->contains(fn ($p) => $user->can($p));
        abort_unless($any, 403, 'Conversations access requires at least one channel permission.');
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $channel = $request->query('channel');
        if ($channel && !in_array($channel, ConversationsService::CHANNELS, true)) {
            return response()->json(['conversations' => []]);
        }
        $this->gateChannel($channel, $user);

        $with = ['participants:id,conversation_id,identity,channel_address'];
        if ($user->isAdmin()) $with[] = 'owner:id,name';

        $query = Conversation::with($with)->ownedBy($user)->orderByDesc('last_message_at');
        if ($channel) $query->where('channel', $channel);

        return response()->json([
            'conversations' => $query->limit(200)->get()->map(fn (Conversation $c) => $this->transform($c, $user->isAdmin())),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $conv = Conversation::with('participants')->ownedBy($user)->findOrFail($id);

        $messages = ConversationMessage::where('conversation_id', $id)
            ->orderBy('twilio_index')
            ->limit(500)
            ->get();

        // Mark unread as read for owner.
        if ($conv->unread_count_for_owner > 0 && $conv->owner_user_id === $user->id) {
            $conv->update(['unread_count_for_owner' => 0]);
        }

        return response()->json([
            'conversation' => $this->transform($conv, $user->isAdmin(), withParticipants: true),
            'messages' => $messages->map(fn (ConversationMessage $m) => [
                'id' => $m->id,
                'twilioSid' => $m->twilio_message_sid,
                'index' => (int) $m->twilio_index,
                'authorIdentity' => $m->author_identity,
                'authorUserId' => $m->author_user_id,
                'body' => $m->body,
                'numMedia' => (int) $m->num_media,
                'deliveryStatus' => $m->delivery_status,
                'sentAt' => $m->sent_at,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'channel' => ['required', 'in:' . implode(',', ConversationsService::CHANNELS)],
            'friendly_name' => ['nullable', 'string', 'max:255'],
            'participant_address' => ['nullable', 'string', 'max:255'],
            'participant_identity' => ['nullable', 'string', 'max:120'],
        ]);

        try {
            $conv = $this->service->createConversation(
                $request->user(),
                $validated['channel'],
                $validated['friendly_name'] ?? '',
            );

            // Always add the creator as identity-based admin participant.
            $this->service->addParticipant($conv, [
                'identity' => \App\Services\Twilio\AccessTokenService::identityFor($request->user()),
                'user_id' => $request->user()->id,
                'role' => 'admin',
            ]);

            // Plus the destination participant (channel-specific shape).
            if ($validated['channel'] === 'chat' && !empty($validated['participant_identity'])) {
                $this->service->addParticipant($conv, ['identity' => $validated['participant_identity']]);
            } elseif (!empty($validated['participant_address'])) {
                $this->service->addParticipant($conv, ['address' => $validated['participant_address']]);
            }
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        return response()->json(['conversation' => $this->transform($conv->fresh('participants'), false)], 201);
    }

    public function send(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:4000'],
        ]);

        $user = $request->user();
        $conv = Conversation::ownedBy($user)->findOrFail($id);

        try {
            $resp = $this->service->sendMessage(
                $conv,
                \App\Services\Twilio\AccessTokenService::identityFor($user),
                $validated['body'],
            );
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        $msg = ConversationMessage::create([
            'conversation_id' => $conv->id,
            'twilio_message_sid' => $resp['sid'],
            'twilio_index' => $resp['index'] ?? 0,
            'author_identity' => \App\Services\Twilio\AccessTokenService::identityFor($user),
            'author_user_id' => $user->id,
            'body' => $validated['body'],
            'delivery_status' => 'sent',
            'sent_at' => now(),
        ]);

        $conv->update(['last_message_at' => now(), 'last_message_index' => $msg->twilio_index]);

        return response()->json(['message' => ['id' => $msg->id, 'twilioSid' => $msg->twilio_message_sid]], 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $conv = Conversation::ownedBy($request->user())->findOrFail($id);
        $this->service->close($conv);
        return response()->json(['ok' => true]);
    }

    private function transform(Conversation $c, bool $includeOwner, bool $withParticipants = false): array
    {
        return [
            'id' => $c->id,
            'twilioSid' => $c->twilio_conversation_sid,
            'channel' => $c->channel,
            'friendlyName' => $c->friendly_name,
            'state' => $c->state,
            'lastMessageAt' => $c->last_message_at,
            'unread' => (int) $c->unread_count_for_owner,
            'owner' => $includeOwner && $c->owner ? ['id' => $c->owner->id, 'name' => $c->owner->name] : null,
            'participants' => $withParticipants && $c->relationLoaded('participants')
                ? $c->participants->map(fn (ConversationParticipant $p) => [
                    'id' => $p->id,
                    'identity' => $p->identity,
                    'address' => $p->channel_address,
                    'role' => $p->role,
                ])
                : null,
        ];
    }
}
