<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoutingQueue extends Model
{
    protected $fillable = [
        'user_id', 'name', 'hold_music_url',
        'position_announcements', 'max_wait_seconds',
        'overflow_action', 'overflow_target',
    ];

    protected $casts = [
        'position_announcements' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
