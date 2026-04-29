<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VideoRoomParticipant extends Model
{
    protected $fillable = [
        'room_id', 'twilio_participant_sid', 'user_id', 'identity',
        'role', 'joined_at', 'left_at', 'duration_seconds',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
    ];

    public function room(): BelongsTo { return $this->belongsTo(VideoRoom::class, 'room_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
