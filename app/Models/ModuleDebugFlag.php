<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ModuleDebugFlag extends Model
{
    protected $fillable = ['module', 'enabled', 'updated_by_user_id'];

    protected $casts = [
        'enabled' => 'boolean',
    ];
}
