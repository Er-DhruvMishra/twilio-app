<?php

namespace App\Models;

use App\Models\Concerns\ScopedToUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MailThread extends Model
{
    use ScopedToUser;

    protected $fillable = [
        'user_id', 'subject_normalized', 'participants',
        'last_mail_at', 'mail_count', 'unread_count',
    ];

    protected $casts = [
        'participants' => 'array',
        'last_mail_at' => 'datetime',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function mails(): HasMany { return $this->hasMany(Mail::class, 'thread_id'); }

    public static function normalizeSubject(string $subject): string
    {
        return trim(preg_replace('/^(re|fwd?|fw):\s*/i', '', $subject) ?? '');
    }
}
