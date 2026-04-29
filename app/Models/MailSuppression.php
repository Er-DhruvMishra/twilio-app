<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MailSuppression extends Model
{
    protected $fillable = ['email', 'type', 'reason', 'suppressed_at'];

    protected $casts = ['suppressed_at' => 'datetime'];
}
