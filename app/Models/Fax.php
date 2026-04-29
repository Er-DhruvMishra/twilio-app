<?php

namespace App\Models;

use App\Models\Concerns\ScopedToUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Fax extends Model
{
    use ScopedToUser;

    protected $fillable = [
        'user_id', 'contact_id', 'direction', 'from_e164', 'to_e164',
        'num_pages', 'status', 'error_code', 'error_message', 'fax_plus_id',
        'document_path', 'is_read', 'cost_cents', 'started_at', 'ended_at', 'payload',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'payload' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(FaxDocument::class);
    }
}
