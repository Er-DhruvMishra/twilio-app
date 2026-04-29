<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConversationParticipant extends Model
{
    protected $fillable = [
        'conversation_id', 'twilio_participant_sid', 'user_id', 'identity',
        'channel_address', 'role', 'last_read_message_index',
        'joined_at', 'left_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
    ];

    public function conversation(): BelongsTo { return $this->belongsTo(Conversation::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
