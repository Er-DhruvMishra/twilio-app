<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    protected $fillable = [
        'twilio_conversation_sid', 'channel', 'friendly_name', 'attributes',
        'owner_user_id', 'last_message_at', 'last_message_index',
        'unread_count_for_owner', 'state',
    ];

    protected $casts = [
        'attributes' => 'array',
        'last_message_at' => 'datetime',
    ];

    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_user_id'); }
    public function participants(): HasMany { return $this->hasMany(ConversationParticipant::class); }
    public function messages(): HasMany { return $this->hasMany(ConversationMessage::class); }

    /** Conversation has its own ownership column. Mirror ScopedToUser's contract. */
    public function scopeOwnedBy(Builder $q, ?User $user): Builder
    {
        if ($user?->isAdmin()) return $q;
        return $q->where('owner_user_id', $user?->id ?? 0);
    }
}
