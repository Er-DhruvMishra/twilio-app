<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoutingRule extends Model
{
    protected $fillable = [
        'user_id', 'name', 'priority', 'is_enabled',
        'match_type', 'match_value',
        'action', 'action_target',
        'time_window', 'last_assigned_user_id',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'match_value' => 'array',
        'action_target' => 'array',
        'time_window' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
