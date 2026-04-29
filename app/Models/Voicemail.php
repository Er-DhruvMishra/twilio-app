<?php

namespace App\Models;

use App\Models\Concerns\ScopedToUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Voicemail extends Model
{
    use ScopedToUser;

    protected $fillable = [
        'user_id', 'call_id', 'recording_id',
        'transcript', 'transcribed_at', 'is_read',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'transcribed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function call(): BelongsTo
    {
        return $this->belongsTo(Call::class);
    }

    public function recording(): BelongsTo
    {
        return $this->belongsTo(Recording::class);
    }
}
