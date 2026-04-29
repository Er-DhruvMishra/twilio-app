<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MailCampaignRecipient extends Model
{
    protected $fillable = [
        'campaign_id', 'contact_id', 'email',
        'merged_subject', 'merged_body_html', 'mail_id', 'status',
    ];

    public function campaign(): BelongsTo { return $this->belongsTo(MailCampaign::class, 'campaign_id'); }
    public function contact(): BelongsTo { return $this->belongsTo(Contact::class); }
    public function mail(): BelongsTo { return $this->belongsTo(Mail::class); }
}
