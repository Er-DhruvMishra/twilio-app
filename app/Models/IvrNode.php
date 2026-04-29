<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IvrNode extends Model
{
    protected $fillable = [
        'ivr_flow_id', 'type', 'config', 'position_x', 'position_y',
    ];

    protected $casts = ['config' => 'array'];

    public function flow(): BelongsTo
    {
        return $this->belongsTo(IvrFlow::class, 'ivr_flow_id');
    }
}
