<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConversationMessage extends Model
{
    protected $fillable = [
        'conversation_id', 'twilio_message_sid', 'twilio_index',
        'author_identity', 'author_user_id', 'body', 'num_media',
        'attributes', 'delivery_status', 'error_code', 'sent_at',
    ];

    protected $casts = [
        'attributes' => 'array',
        'sent_at' => 'datetime',
    ];

    public function conversation(): BelongsTo { return $this->belongsTo(Conversation::class); }
    public function author(): BelongsTo { return $this->belongsTo(User::class, 'author_user_id'); }
    public function media(): HasMany { return $this->hasMany(ConversationMedia::class, 'message_id'); }
}
