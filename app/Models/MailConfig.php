<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MailConfig extends Model
{
    protected $fillable = [
        'user_id', 'api_key', 'webhook_verify_key', 'from_email',
        'from_name', 'inbound_host', 'is_active', 'verified_at',
    ];

    protected $casts = [
        'api_key' => 'encrypted',
        'webhook_verify_key' => 'encrypted',
        'is_active' => 'boolean',
        'verified_at' => 'datetime',
    ];

    public static function active(): ?self
    {
        return static::where('is_active', true)->orderByDesc('id')->first();
    }
}
