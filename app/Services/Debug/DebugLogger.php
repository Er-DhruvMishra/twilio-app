<?php

namespace App\Services\Debug;

use App\Models\ModuleDebugFlag;
use Illuminate\Support\Facades\Log;

/**
 * Per-module debug logger. When a module's flag is on, services call
 * `DebugLogger::log('lookup', 'request', [...])` to stream both inputs
 * and outputs to storage/logs/module-debug.log.
 *
 * Sensitive fields (tokens, secrets, signing keys) are redacted.
 *
 * Failures here must never break the primary request — every call site
 * is wrapped in a try/catch.
 */
class DebugLogger
{
    public const MODULES = [
        'voice',         // Twilio Voice/Calls + AccessToken + TwiML
        'messaging',     // SMS / MMS
        'lookup',        // Twilio Lookup v2
        'billing',       // Twilio Usage + Balance
        'conversations', // Twilio Conversations API (Chat/RCS/WhatsApp/FB)
        'video',         // Twilio Video rooms + recordings
        'fax',           // fax.plus
        'mail',          // SendGrid
        'webhooks',      // Inbound webhook payloads (signature debugging)
    ];

    private const SENSITIVE_KEYS = [
        'api_token', 'api_key', 'apikey', 'auth_token', 'authtoken', 'authorization',
        'webhook_signing_key', 'webhook_verify_key', 'verify_key',
        'token', 'secret', 'password', 'p256dh_key', 'auth',
        'account_sid_enc', 'auth_token_enc', 'api_key_secret_enc',
    ];

    /** @var array<string,bool> Per-request memoization to avoid hitting the DB for every log call. */
    private static array $cache = [];

    public static function enabled(string $module): bool
    {
        if (array_key_exists($module, self::$cache)) return self::$cache[$module];

        try {
            $on = ModuleDebugFlag::where('module', $module)
                ->where('enabled', true)
                ->exists();
        } catch (\Throwable) {
            $on = false;
        }
        return self::$cache[$module] = $on;
    }

    /**
     * Log a structured event for `$module`. No-op when the flag is off.
     *
     * Convention for `$action`: 'request', 'response', 'error', 'webhook',
     * 'twiml-in', 'twiml-out'. Free-form is fine, but consistency helps grep.
     */
    public static function log(string $module, string $action, array $context = []): void
    {
        if (!self::enabled($module)) return;

        try {
            Log::channel('module-debug')->info("[{$module}] {$action}", self::redact($context));
        } catch (\Throwable) {
            // Never let logging break the caller.
        }
    }

    /** Convenience: log paired request + response in one call. */
    public static function trace(string $module, string $endpoint, array $request, mixed $response = null, ?\Throwable $error = null): void
    {
        if (!self::enabled($module)) return;

        $entry = [
            'endpoint' => $endpoint,
            'request' => $request,
            'response' => is_object($response) ? self::serialize($response) : $response,
        ];
        if ($error) {
            $entry['error'] = [
                'class' => $error::class,
                'message' => $error->getMessage(),
                'code' => $error->getCode(),
            ];
        }

        try {
            Log::channel('module-debug')->info("[{$module}] {$endpoint}", self::redact($entry));
        } catch (\Throwable) {
            // Swallow.
        }
    }

    /** Reset the per-request cache. Useful for tests + the settings save flow. */
    public static function flush(): void
    {
        self::$cache = [];
    }

    private static function serialize(mixed $value): mixed
    {
        try {
            return json_decode(json_encode($value), true);
        } catch (\Throwable) {
            return ['_unserializable' => true];
        }
    }

    /** Recursively redact known-sensitive keys (case-insensitive). */
    private static function redact(array $data): array
    {
        $out = [];
        foreach ($data as $k => $v) {
            $lower = is_string($k) ? strtolower((string) $k) : $k;
            if (is_string($lower) && self::isSensitive($lower)) {
                $out[$k] = '[REDACTED]';
                continue;
            }
            if (is_array($v)) {
                $out[$k] = self::redact($v);
            } elseif (is_string($v) && self::looksLikeSecret($v)) {
                $out[$k] = self::redactString($v);
            } else {
                $out[$k] = $v;
            }
        }
        return $out;
    }

    private static function isSensitive(string $key): bool
    {
        foreach (self::SENSITIVE_KEYS as $needle) {
            if (str_contains($key, $needle)) return true;
        }
        return false;
    }

    private static function looksLikeSecret(string $v): bool
    {
        // Twilio account SIDs (AC...), auth tokens (32 hex), API keys (SK...),
        // SendGrid (SG...), fax.plus tokens, JWTs.
        if (preg_match('/^(AC|SK|AP|MG|IS|VA|RM|CH|MM|SG)\.?[A-Za-z0-9]{20,}$/', $v)) return true;
        if (str_starts_with($v, 'eyJ') && substr_count($v, '.') >= 2) return true; // JWT
        return false;
    }

    private static function redactString(string $v): string
    {
        $len = strlen($v);
        if ($len <= 8) return '[REDACTED]';
        return substr($v, 0, 4) . '…[' . ($len - 8) . 'chars]…' . substr($v, -4);
    }
}
