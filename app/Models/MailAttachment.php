<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MailAttachment extends Model
{
    protected $fillable = ['mail_id', 'original_name', 'content_type', 'size_bytes', 'local_path'];

    public function mail(): BelongsTo { return $this->belongsTo(Mail::class); }
}
