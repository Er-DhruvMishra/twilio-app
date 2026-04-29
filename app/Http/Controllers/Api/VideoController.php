<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VideoRecording;
use App\Models\VideoRoom;
use App\Services\Twilio\AccessTokenService;
use App\Services\Twilio\VideoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VideoController extends Controller
{
    public function __construct(
        private VideoService $service,
        private AccessTokenService $tokens,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $with = ['participants:id,room_id,identity,joined_at,left_at,role'];
        if ($user->isAdmin()) $with[] = 'creator:id,name';

        $status = $request->query('status'); // in-progress|completed|null
        $query = VideoRoom::with($with)->ownedBy($user)->orderByDesc('started_at');
        if ($status) $query->where('status', $status);

        return response()->json([
            'rooms' => $query->limit(100)->get()->map(fn (VideoRoom $r) => $this->transform($r, $user->isAdmin())),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $room = VideoRoom::with(['participants', 'recordings'])
            ->ownedBy($user)
            ->findOrFail($id);
        return response()->json([
            'room' => $this->transform($room, $user->isAdmin(), withDetails: true),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', 'in:group,group-small,peer-to-peer,go'],
            'max_participants' => ['nullable', 'integer', 'min:2', 'max:50'],
            'record_participants' => ['boolean'],
        ]);

        try {
            $room = $this->service->createRoom(
                $request->user(),
                $validated['name'],
                $validated['type'],
                $validated['record_participants'] ?? false,
                $validated['max_participants'] ?? self::defaultMaxFor($validated['type']),
            );
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        return response()->json(['room' => $this->transform($room, false)], 201);
    }

    /** Mint a fresh access token scoped to the requested room. */
    public function token(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $room = VideoRoom::ownedBy($user)->findOrFail($id);
        if ($room->status !== 'in-progress') {
            return response()->json(['message' => 'Room is no longer in progress.'], 422);
        }

        $token = $this->tokens->issueFor($user, ['video_room' => $room->twilio_room_sid]);
        return response()->json([
            'token' => $token['token'],
            'identity' => $token['identity'],
            'expiresIn' => $token['expires_in'],
            'roomName' => $room->twilio_room_sid,
        ]);
    }

    public function end(Request $request, int $id): JsonResponse
    {
        $request->user()->can('manage-video-rooms') || abort(403);
        $room = VideoRoom::ownedBy($request->user())->findOrFail($id);
        $this->service->endRoom($room);
        return response()->json(['ok' => true]);
    }

    public function compose(Request $request, int $id): JsonResponse
    {
        $request->user()->can('manage-video-rooms') || abort(403);
        $room = VideoRoom::ownedBy($request->user())->findOrFail($id);
        try {
            $compSid = $this->service->composeRoom($room);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
        return response()->json(['ok' => true, 'compositionSid' => $compSid]);
    }

    public function kick(Request $request, int $id, string $participantSid): JsonResponse
    {
        $request->user()->can('manage-video-rooms') || abort(403);
        $room = VideoRoom::ownedBy($request->user())->findOrFail($id);
        $this->service->kickParticipant($room, $participantSid);
        return response()->json(['ok' => true]);
    }

    public function recordings(Request $request): JsonResponse
    {
        $request->user()->can('view-video-recordings') || abort(403);
        $rooms = VideoRoom::ownedBy($request->user())->pluck('id');
        $recordings = VideoRecording::with('room:id,name,started_at')
            ->whereIn('room_id', $rooms)
            ->orderByDesc('id')
            ->limit(200)
            ->get();
        return response()->json(['recordings' => $recordings]);
    }

    private function transform(VideoRoom $r, bool $includeOwner, bool $withDetails = false): array
    {
        return [
            'id' => $r->id,
            'twilioSid' => $r->twilio_room_sid,
            'name' => $r->name,
            'type' => $r->type,
            'status' => $r->status,
            'maxParticipants' => (int) $r->max_participants,
            'recordParticipants' => (bool) $r->record_participants,
            'startedAt' => $r->started_at,
            'endedAt' => $r->ended_at,
            'creator' => $includeOwner && $r->creator ? ['id' => $r->creator->id, 'name' => $r->creator->name] : null,
            'participants' => $r->relationLoaded('participants')
                ? $r->participants->map(fn ($p) => [
                    'id' => $p->id,
                    'twilioSid' => $p->twilio_participant_sid,
                    'identity' => $p->identity,
                    'role' => $p->role,
                    'joinedAt' => $p->joined_at,
                    'leftAt' => $p->left_at,
                ])
                : null,
            'recordings' => $withDetails && $r->relationLoaded('recordings')
                ? $r->recordings->map(fn ($rec) => [
                    'id' => $rec->id,
                    'status' => $rec->status,
                    'durationSeconds' => (int) $rec->duration_seconds,
                    'mediaUrl' => $rec->media_url,
                ])
                : null,
        ];
    }

    private static function defaultMaxFor(string $type): int
    {
        return match ($type) {
            'group' => 50,
            'group-small' => 4,
            'peer-to-peer', 'go' => 2,
            default => 10,
        };
    }
}
