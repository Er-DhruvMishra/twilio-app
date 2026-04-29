<?php

namespace App\Models;

use App\Models\Concerns\ScopedToUser;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Call extends Model
{
    use HasFactory, ScopedToUser;

    protected $fillable = [
        'user_id', 'contact_id', 'twilio_call_sid', 'parent_call_sid',
        'direction', 'from_e164', 'to_e164', 'status', 'disposition',
        'tag', 'forwarded_to_e164', 'recording_id', 'is_voicemail',
        'started_at', 'answered_at', 'ended_at', 'duration_seconds',
        'metadata',
    ];

    protected $casts = [
        'is_voicemail' => 'boolean',
        'started_at' => 'datetime',
        'answered_at' => 'datetime',
        'ended_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function recording(): BelongsTo
    {
        return $this->belongsTo(Recording::class);
    }

    public function recordings(): HasMany
    {
        return $this->hasMany(Recording::class);
    }

    public function voicemail(): HasOne
    {
        return $this->hasOne(Voicemail::class);
    }
}
