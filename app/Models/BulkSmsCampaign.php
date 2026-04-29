<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BulkSmsCampaign extends Model
{
    protected $fillable = [
        'user_id', 'template_id', 'name', 'status',
        'scheduled_at', 'started_at', 'completed_at',
        'total_recipients', 'sent_count', 'failed_count',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(SmsTemplate::class, 'template_id');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(BulkSmsRecipient::class, 'campaign_id');
    }
}
