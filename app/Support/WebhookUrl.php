<?php

namespace App\Support;

class WebhookUrl
{
    /**
     * Resolve a webhook URL Twilio can reach.
     *
     * Priority:
     *  1. WEBHOOK_BASE_URL env (typically the active ngrok https URL)
     *  2. APP_URL  (works for prod with a real public domain)
     *
     * Always returns an absolute URL with no trailing slash.
     */
    public static function for(string $path): string
    {
        $base = rtrim((string) env('WEBHOOK_BASE_URL') ?: (string) config('app.url'), '/');
        return $base . '/' . ltrim($path, '/');
    }

    public static function base(): string
    {
        return rtrim((string) env('WEBHOOK_BASE_URL') ?: (string) config('app.url'), '/');
    }

    public static function isPublic(): bool
    {
        $base = self::base();
        return str_starts_with($base, 'https://') && !preg_match('#^https://(localhost|127\.0\.0\.1)#', $base);
    }
}
