<?php

namespace App\Services\AI;

use App\Models\Call;
use App\Models\Message;

/**
 * Stub spam detector. Wire a real provider (OpenAI moderation, Twilio Verify
 * Lookup, internal model, etc.) in `detect*()` and the rest of the app picks
 * it up automatically — Call::tag and Message::tag.
 *
 * Bind a different implementation in App\Providers\AppServiceProvider:
 *
 *     $this->app->bind(SpamDetector::class, MyOpenAiSpamDetector::class);
 */
class SpamDetector
{
    public function detectCall(Call $call): ?string
    {
        // return 'spam' to flag, 'lead' / 'important' for positive tags, or null.
        return null;
    }

    public function detectMessage(Message $message): ?string
    {
        return null;
    }
}
