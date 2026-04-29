<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentSkill extends Model
{
    protected $fillable = ['user_id', 'skill', 'weight'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
