<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use NotificationChannels\WebPush\HasPushSubscriptions;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasRoles, HasPushSubscriptions;

    protected $fillable = [
        'name',
        'email',
        'password',
        'presence',
        'last_seen_at',
        'phone_extension',
        'personal_phone_e164',
        'skills',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'password' => 'hashed',
            'skills' => 'array',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function isAvailable(): bool
    {
        return $this->presence === 'available';
    }

    public function calls()
    {
        return $this->hasMany(\App\Models\Call::class);
    }

    public function messages()
    {
        return $this->hasMany(\App\Models\Message::class);
    }

    public function contacts()
    {
        return $this->hasMany(\App\Models\Contact::class);
    }
}
