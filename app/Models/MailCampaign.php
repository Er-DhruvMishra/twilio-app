<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MailCampaign extends Model
{
    protected $fillable = [
        'user_id', 'name', 'template_id', 'subject', 'body_html',
        'status', 'scheduled_at', 'started_at', 'completed_at',
        'total_recipients', 'sent_count', 'delivered_count',
        'opened_count', 'clicked_count', 'bounced_count',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function template(): BelongsTo { return $this->belongsTo(MailTemplate::class, 'template_id'); }
    public function recipients(): HasMany { return $this->hasMany(MailCampaignRecipient::class, 'campaign_id'); }
}
