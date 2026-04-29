<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FaxConfig extends Model
{
    protected $fillable = [
        'user_id', 'api_token', 'webhook_signing_key', 'from_number',
        'account_id', 'is_active', 'verified_at',
    ];

    protected $casts = [
        'api_token' => 'encrypted',
        'webhook_signing_key' => 'encrypted',
        'is_active' => 'boolean',
        'verified_at' => 'datetime',
    ];

    public static function active(): ?self
    {
        return static::where('is_active', true)->orderByDesc('id')->first();
    }
}
