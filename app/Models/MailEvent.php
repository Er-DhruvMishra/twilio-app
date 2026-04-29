<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MailEvent extends Model
{
    protected $fillable = ['sg_message_id', 'email', 'event', 'event_timestamp', 'payload'];

    protected $casts = [
        'payload' => 'array',
        'event_timestamp' => 'datetime',
    ];
}
