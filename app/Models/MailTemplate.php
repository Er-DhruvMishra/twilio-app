<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MailTemplate extends Model
{
    protected $fillable = [
        'user_id', 'name', 'sg_template_id', 'subject', 'body_html',
        'variables', 'last_synced_at',
    ];

    protected $casts = [
        'variables' => 'array',
        'last_synced_at' => 'datetime',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
