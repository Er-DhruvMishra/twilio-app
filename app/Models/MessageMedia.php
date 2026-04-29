<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageMedia extends Model
{
    protected $table = 'message_media';

    protected $fillable = [
        'message_id', 'content_type', 'media_url', 'local_path', 'size_bytes',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}
