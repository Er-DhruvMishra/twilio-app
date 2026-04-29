<?php

namespace App\Models;

use App\Models\Concerns\ScopedToUser;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    use HasFactory, ScopedToUser;

    protected $fillable = [
        'user_id', 'contact_id', 'twilio_message_sid', 'direction',
        'from_e164', 'to_e164', 'body', 'num_media', 'status',
        'error_code', 'error_message', 'thread_key', 'is_read',
        'sent_at', 'delivered_at',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(MessageMedia::class);
    }

    public static function threadKey(string $a, string $b): string
    {
        $sorted = [$a, $b];
        sort($sorted);
        return implode('|', $sorted);
    }
}
