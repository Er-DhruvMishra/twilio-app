<?php

namespace App\Models;

use App\Models\Concerns\ScopedToUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Mail extends Model
{
    use ScopedToUser;

    protected $fillable = [
        'user_id', 'contact_id', 'thread_id', 'direction',
        'sg_message_id', 'message_id_header', 'in_reply_to',
        'from_email', 'from_name', 'to_email', 'cc', 'bcc',
        'subject', 'body_html', 'body_text', 'headers',
        'status', 'error_code', 'error_message',
        'opened_at', 'clicked_at', 'bounced_at', 'is_read', 'sent_at',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'headers' => 'array',
        'opened_at' => 'datetime',
        'clicked_at' => 'datetime',
        'bounced_at' => 'datetime',
        'sent_at' => 'datetime',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function contact(): BelongsTo { return $this->belongsTo(Contact::class); }
    public function thread(): BelongsTo { return $this->belongsTo(MailThread::class, 'thread_id'); }
    public function attachments(): HasMany { return $this->hasMany(MailAttachment::class); }
}
