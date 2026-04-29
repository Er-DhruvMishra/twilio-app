<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Message;
use App\Services\Twilio\SmsSender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MessageController extends Controller
{
    public function __construct(private SmsSender $sender) {}

    /** List threads with the latest message + unread count. */
    public function threads(Request $request): JsonResponse
    {
        $user = $request->user();

        // For admin, "thread_key" can collide across users (same number pair on
        // different agents' phones). Group by (user_id, thread_key) to keep
        // them distinct in the listing.
        $isAdmin = $user->isAdmin();
        $groupCols = $isAdmin ? ['user_id', 'thread_key'] : ['thread_key'];

        $latestPerThread = Message::select(array_merge($groupCols, [DB::raw('MAX(id) as latest_id')]))
            ->ownedBy($user)
            ->groupBy(...$groupCols)
            ->orderByDesc('latest_id')
            ->limit(200)
            ->get();

        $latestIds = $latestPerThread->pluck('latest_id');
        $with = ['contact:id,display_name,phone_e164'];
        if ($isAdmin) $with[] = 'user:id,name';
        $latest = Message::with($with)
            ->whereIn('id', $latestIds)
            ->orderByDesc('id')
            ->get();

        $unreadCounts = Message::ownedBy($user)
            ->where('direction', 'inbound')
            ->where('is_read', false)
            ->select(array_merge($groupCols, [DB::raw('COUNT(*) as cnt')]))
            ->groupBy(...$groupCols)
            ->get()
            ->keyBy(fn ($r) => $isAdmin ? "{$r->user_id}|{$r->thread_key}" : $r->thread_key);

        return response()->json([
            'threads' => $latest->values()->map(fn (Message $m) => [
                'threadKey' => $m->thread_key,
                'peer' => $this->peerOf($m),
                'contact' => $m->contact ? [
                    'id' => $m->contact->id,
                    'name' => $m->contact->display_name,
                ] : null,
                'owner' => $isAdmin && $m->user ? [
                    'id' => $m->user->id,
                    'name' => $m->user->name,
                ] : null,
                'lastMessage' => [
                    'body' => $m->body,
                    'numMedia' => $m->num_media,
                    'direction' => $m->direction,
                    'status' => $m->status,
                    'sentAt' => $m->sent_at ?? $m->created_at,
                ],
                'unread' => (int) (
                    $isAdmin
                        ? ($unreadCounts["{$m->user_id}|{$m->thread_key}"]->cnt ?? 0)
                        : ($unreadCounts[$m->thread_key]->cnt ?? 0)
                ),
            ]),
        ]);
    }

    /** All messages in one thread, oldest first. */
    public function thread(Request $request, string $threadKey): JsonResponse
    {
        $user = $request->user();
        // Admin can scope a thread view to a specific agent via ?owner=<userId>;
        // otherwise threadKey alone identifies an agent's thread (admin sees
        // the union, which can mix users — usually fine for read-only audit).
        $ownerFilter = $user->isAdmin() ? $request->query('owner') : $user->id;

        $with = ['contact:id,display_name,phone_e164', 'media:id,message_id,media_url,content_type'];
        if ($user->isAdmin()) $with[] = 'user:id,name';

        $query = Message::with($with)
            ->ownedBy($user)
            ->where('thread_key', $threadKey);
        if ($ownerFilter) $query->where('user_id', $ownerFilter);

        $messages = $query->orderBy('id')->limit(500)->get();

        // Mark inbound as read for the calling user only (admin viewing
        // doesn't auto-mark another agent's messages as read).
        Message::where('user_id', $user->id)
            ->where('thread_key', $threadKey)
            ->where('direction', 'inbound')
            ->where('is_read', false)
            ->update(['is_read' => true]);

        if ($user->isAdmin() && $messages->isNotEmpty() && $messages->first()->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.message.thread', $messages->first(), [
                'viewed_user_id' => $messages->first()->user_id,
                'thread_key' => $threadKey,
            ]);
        }

        $first = $messages->first();
        $peer = $first ? $this->peerOf($first) : null;

        return response()->json([
            'threadKey' => $threadKey,
            'peer' => $peer,
            'contact' => $first?->contact ? [
                'id' => $first->contact->id,
                'name' => $first->contact->display_name,
            ] : null,
            'owner' => $user->isAdmin() && $first?->user ? [
                'id' => $first->user->id,
                'name' => $first->user->name,
            ] : null,
            'messages' => $messages->map(fn (Message $m) => [
                'id' => $m->id,
                'direction' => $m->direction,
                'body' => $m->body,
                'numMedia' => $m->num_media,
                'media' => $m->media->map(fn ($x) => ['url' => $x->media_url, 'contentType' => $x->content_type]),
                'status' => $m->status,
                'errorCode' => $m->error_code,
                'errorMessage' => $m->error_message,
                'sentAt' => $m->sent_at ?? $m->created_at,
                'deliveredAt' => $m->delivered_at,
            ]),
        ]);
    }

    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to' => ['required', 'string', 'starts_with:+'],
            'body' => ['required_without:media_urls', 'string', 'max:1600'],
            'media_urls' => ['nullable', 'array', 'max:10'],
            'media_urls.*' => ['url'],
        ]);

        try {
            $message = $this->sender->send(
                $request->user(),
                $validated['to'],
                $validated['body'] ?? '',
                $validated['media_urls'] ?? [],
            );
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => [
                'id' => $message->id,
                'threadKey' => $message->thread_key,
                'status' => $message->status,
            ],
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if ($q === '') return response()->json(['results' => []]);

        $user = $request->user();
        $with = ['contact:id,display_name,phone_e164'];
        if ($user->isAdmin()) $with[] = 'user:id,name';

        $results = Message::with($with)
            ->ownedBy($user)
            ->where(function ($w) use ($q) {
                $w->where('body', 'like', "%{$q}%")
                  ->orWhere('from_e164', 'like', "%{$q}%")
                  ->orWhere('to_e164', 'like', "%{$q}%");
            })
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (Message $m) => [
                'id' => $m->id,
                'threadKey' => $m->thread_key,
                'peer' => $this->peerOf($m),
                'contact' => $m->contact ? ['id' => $m->contact->id, 'name' => $m->contact->display_name] : null,
                'owner' => $user->isAdmin() && $m->user ? ['id' => $m->user->id, 'name' => $m->user->name] : null,
                'snippet' => mb_substr((string) $m->body, 0, 120),
                'sentAt' => $m->sent_at ?? $m->created_at,
            ]);

        return response()->json(['results' => $results]);
    }

    private function peerOf(Message $m): string
    {
        return $m->direction === 'inbound' ? $m->from_e164 : $m->to_e164;
    }
}
