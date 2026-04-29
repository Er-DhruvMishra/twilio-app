<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Recording extends Model
{
    protected $fillable = [
        'call_id', 'twilio_recording_sid', 'media_url', 'local_path',
        'duration_seconds', 'channels', 'status',
    ];

    public function call(): BelongsTo
    {
        return $this->belongsTo(Call::class);
    }
}
