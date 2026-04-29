<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VideoRecording extends Model
{
    protected $fillable = [
        'room_id', 'participant_id', 'twilio_recording_sid',
        'twilio_composition_sid', 'status', 'format',
        'duration_seconds', 'size_bytes', 'media_url',
    ];

    public function room(): BelongsTo { return $this->belongsTo(VideoRoom::class, 'room_id'); }
    public function participant(): BelongsTo { return $this->belongsTo(VideoRoomParticipant::class, 'participant_id'); }
}
