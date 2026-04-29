<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BlockedNumber extends Model
{
    protected $fillable = [
        'user_id', 'phone_e164', 'mode',
        'pattern_type', 'pattern_value', 'reason',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
