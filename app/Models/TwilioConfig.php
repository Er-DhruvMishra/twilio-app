<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TwilioConfig extends Model
{
    protected $fillable = [
        'user_id', 'tenant_id',
        'account_sid_enc', 'auth_token_enc', 'api_key_sid_enc', 'api_key_secret_enc',
        'twiml_app_sid', 'phone_number', 'phone_number_sid',
        'is_active', 'verified_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'verified_at' => 'datetime',
        'account_sid_enc' => 'encrypted',
        'auth_token_enc' => 'encrypted',
        'api_key_sid_enc' => 'encrypted',
        'api_key_secret_enc' => 'encrypted',
    ];

    public function getAccountSidAttribute(): ?string
    {
        return $this->account_sid_enc;
    }

    public function getAuthTokenAttribute(): ?string
    {
        return $this->auth_token_enc;
    }

    public function getApiKeySidAttribute(): ?string
    {
        return $this->api_key_sid_enc;
    }

    public function getApiKeySecretAttribute(): ?string
    {
        return $this->api_key_secret_enc;
    }

    public static function active(): ?self
    {
        return static::where('is_active', true)->whereNotNull('verified_at')->first();
    }
}
