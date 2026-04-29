<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BillingSnapshot extends Model
{
    protected $fillable = [
        'period_start', 'period_end', 'balance_cents', 'currency',
        'totals', 'raw', 'fetched_at',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'totals' => 'array',
        'raw' => 'array',
        'fetched_at' => 'datetime',
    ];
}
