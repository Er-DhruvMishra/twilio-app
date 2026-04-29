<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConversationsConfig extends Model
{
    protected $table = 'conversations_configs';

    protected $fillable = [
        'user_id', 'service_sid', 'rcs_agent_sid',
        'whatsapp_from', 'facebook_page_id',
        'chat_enabled', 'rcs_enabled', 'whatsapp_enabled', 'facebook_enabled',
        'is_active',
    ];

    protected $casts = [
        'chat_enabled' => 'boolean',
        'rcs_enabled' => 'boolean',
        'whatsapp_enabled' => 'boolean',
        'facebook_enabled' => 'boolean',
        'is_active' => 'boolean',
    ];

    public static function active(): ?self
    {
        return static::where('is_active', true)->orderByDesc('id')->first();
    }
}
