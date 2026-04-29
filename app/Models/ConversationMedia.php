<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConversationMedia extends Model
{
    protected $table = 'conversation_media';

    protected $fillable = [
        'message_id', 'twilio_media_sid', 'content_type',
        'size_bytes', 'filename', 'local_path',
    ];

    public function message(): BelongsTo { return $this->belongsTo(ConversationMessage::class, 'message_id'); }
}
