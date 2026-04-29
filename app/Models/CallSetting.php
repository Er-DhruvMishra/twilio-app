<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CallSetting extends Model
{
    protected $fillable = [
        'user_id', 'recording_enabled', 'recording_announcement',
        'forward_always_to', 'forward_busy_to', 'forward_no_answer_to',
        'forward_unreachable_to', 'no_answer_timeout_seconds',
        'voicemail_enabled', 'voicemail_greeting_url',
        'default_caller_id', 'ringtone', 'simultaneous_ring_to',
        'auto_lookup_inbound', 'auto_lookup_outbound', 'lookup_cache_days',
        'speed_dial_slots',
    ];

    protected $casts = [
        'recording_enabled' => 'boolean',
        'recording_announcement' => 'boolean',
        'voicemail_enabled' => 'boolean',
        'simultaneous_ring_to' => 'array',
        'auto_lookup_inbound' => 'boolean',
        'auto_lookup_outbound' => 'boolean',
        'speed_dial_slots' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function forUser(User $user): self
    {
        return static::firstOrCreate(['user_id' => $user->id], []);
    }
}
