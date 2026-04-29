<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BulkSmsRecipient extends Model
{
    protected $fillable = [
        'campaign_id', 'contact_id', 'phone_e164',
        'merged_body', 'message_id', 'status', 'error_code',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(BulkSmsCampaign::class, 'campaign_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}
