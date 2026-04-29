<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VideoRoom extends Model
{
    protected $fillable = [
        'twilio_room_sid', 'name', 'type', 'status', 'max_participants',
        'record_participants', 'created_by_user_id',
        'started_at', 'ended_at', 'duration_seconds',
    ];

    protected $casts = [
        'record_participants' => 'boolean',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by_user_id'); }
    public function participants(): HasMany { return $this->hasMany(VideoRoomParticipant::class, 'room_id'); }
    public function recordings(): HasMany { return $this->hasMany(VideoRecording::class, 'room_id'); }

    public function scopeOwnedBy(Builder $q, ?User $user): Builder
    {
        if ($user?->isAdmin()) return $q;
        // For non-admins: rooms they created OR rooms they've joined.
        return $q->where(function ($w) use ($user) {
            $w->where('created_by_user_id', $user?->id ?? 0)
              ->orWhereExists(function ($sub) use ($user) {
                  $sub->select(\DB::raw(1))
                      ->from('video_room_participants')
                      ->whereColumn('video_room_participants.room_id', 'video_rooms.id')
                      ->where('user_id', $user?->id ?? 0);
              });
        });
    }
}
