<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IvrFlow extends Model
{
    protected $fillable = [
        'user_id', 'name', 'is_published', 'version',
        'entry_node_id', 'assigned_phone_numbers',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'assigned_phone_numbers' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function nodes(): HasMany
    {
        return $this->hasMany(IvrNode::class);
    }

    public function entryNode(): BelongsTo
    {
        return $this->belongsTo(IvrNode::class, 'entry_node_id');
    }
}
