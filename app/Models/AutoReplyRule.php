<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutoReplyRule extends Model
{
    protected $fillable = [
        'user_id', 'name', 'match_type', 'match_value',
        'body', 'is_enabled', 'priority',
    ];

    protected $casts = [
        'match_value' => 'array',
        'is_enabled' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
