<?php

namespace App\Models;

use App\Models\Concerns\ScopedToUser;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contact extends Model
{
    use HasFactory, ScopedToUser;

    protected $fillable = [
        'user_id', 'display_name', 'phone_e164', 'phone_normalized',
        'email', 'notes', 'avatar_path', 'is_blocked', 'is_favorite', 'source',
    ];

    protected $casts = [
        'is_blocked' => 'boolean',
        'is_favorite' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(ContactTag::class, 'contact_tag');
    }

    public function calls(): HasMany
    {
        return $this->hasMany(Call::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }
}
