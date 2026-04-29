<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lookup extends Model
{
    protected $fillable = [
        'phone_e164', 'caller_name', 'caller_type', 'line_type', 'carrier_name',
        'country_code', 'country_name', 'is_valid', 'payload', 'requested_by_user_id',
        'source', 'cost_cents', 'looked_up_at',
    ];

    protected $casts = [
        'is_valid' => 'boolean',
        'payload' => 'array',
        'looked_up_at' => 'datetime',
    ];

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }
}
