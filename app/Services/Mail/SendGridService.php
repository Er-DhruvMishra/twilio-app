<?php

namespace App\Services\Mail;

use App\Models\MailConfig;
use App\Services\Debug\DebugLogger;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * Twilio SendGrid REST wrapper. Bypasses Laravel's mail driver so we get
 * Inbound Parse + Event Webhook + suppressions + dynamic templates without
 * fighting the abstraction.
 *
 * Auth: Bearer API key from SendGrid dashboard.
 * Base: https://api.sendgrid.com/v3/
 */
class SendGridService
{
    public const BASE = 'https://api.sendgrid.com/v3';

    private function http(): PendingRequest
    {
        $config = MailConfig::active();
        $key = $config?->api_key ?? env('SENDGRID_API_KEY');
        if (!$key) throw new \RuntimeException('SendGrid API key not configured.');
        return Http::withToken($key)->baseUrl(self::BASE)->acceptJson()->timeout(30);
    }

    /**
     * Send a mail via /mail/send. Returns the X-Message-Id header which
     * doubles as our `sg_message_id` for matching webhook events.
     */
    public function send(array $payload): string
    {
        $config = MailConfig::active();
        $from = [
            'email' => $payload['from_email'] ?? $config?->from_email ?? env('SENDGRID_FROM_EMAIL'),
            'name' => $payload['from_name'] ?? $config?->from_name ?? null,
        ];

        $personalizations = [[
            'to' => array_map(fn ($e) => ['email' => $e], (array) ($payload['to'] ?? [])),
            'subject' => $payload['subject'] ?? '',
        ]];
        if (!empty($payload['cc'])) {
            $personalizations[0]['cc'] = array_map(fn ($e) => ['email' => $e], (array) $payload['cc']);
        }
        if (!empty($payload['bcc'])) {
            $personalizations[0]['bcc'] = array_map(fn ($e) => ['email' => $e], (array) $payload['bcc']);
        }
        if (!empty($payload['dynamic_template_data'])) {
            $personalizations[0]['dynamic_template_data'] = $payload['dynamic_template_data'];
        }

        $body = [
            'personalizations' => $personalizations,
            'from' => array_filter($from),
        ];

        if (!empty($payload['template_id'])) {
            $body['template_id'] = $payload['template_id'];
        } else {
            $content = [];
            if (!empty($payload['body_text'])) {
                $content[] = ['type' => 'text/plain', 'value' => $payload['body_text']];
            }
            if (!empty($payload['body_html'])) {
                $content[] = ['type' => 'text/html', 'value' => $payload['body_html']];
            }
            if (empty($content)) {
                $content[] = ['type' => 'text/plain', 'value' => ''];
            }
            $body['content'] = $content;
        }

        if (!empty($payload['attachments'])) {
            $body['attachments'] = $payload['attachments']; // already encoded {content, type, filename}
        }

        try {
            $resp = $this->http()->post('/mail/send', $body);
            $resp->throw();
            DebugLogger::trace('mail', 'POST /mail/send', $body, ['status' => $resp->status(), 'message_id' => $resp->header('X-Message-Id')]);
        } catch (\Throwable $e) {
            DebugLogger::trace('mail', 'POST /mail/send', $body, null, $e);
            throw $e;
        }
        return (string) $resp->header('X-Message-Id');
    }

    public function listTemplates(): array
    {
        $params = ['generations' => 'dynamic', 'page_size' => 50];
        try {
            $resp = $this->http()->get('/templates', $params);
            $resp->throw();
            DebugLogger::trace('mail', 'GET /templates', $params, ['status' => $resp->status(), 'count' => count($resp->json('result', []))]);
        } catch (\Throwable $e) {
            DebugLogger::trace('mail', 'GET /templates', $params, null, $e);
            throw $e;
        }
        return $resp->json('result', []);
    }

    public function getStats(string $start, string $end, string $aggregatedBy = 'day'): array
    {
        $params = ['start_date' => $start, 'end_date' => $end, 'aggregated_by' => $aggregatedBy];
        try {
            $resp = $this->http()->get('/stats', $params);
            $resp->throw();
            DebugLogger::trace('mail', 'GET /stats', $params, ['status' => $resp->status(), 'days' => count($resp->json() ?? [])]);
        } catch (\Throwable $e) {
            DebugLogger::trace('mail', 'GET /stats', $params, null, $e);
            throw $e;
        }
        return $resp->json();
    }

    public function listSuppressions(string $type): array
    {
        $endpoint = match ($type) {
            'bounce' => '/suppression/bounces',
            'spam' => '/suppression/spam_reports',
            'unsubscribe' => '/asm/suppressions/global',
            'invalid' => '/suppression/invalid_emails',
            'block' => '/suppression/blocks',
            default => '/suppression/bounces',
        };
        try {
            $resp = $this->http()->get($endpoint);
            $resp->throw();
            DebugLogger::trace('mail', "GET {$endpoint}", ['type' => $type], ['status' => $resp->status(), 'count' => is_countable($resp->json()) ? count($resp->json()) : null]);
        } catch (\Throwable $e) {
            DebugLogger::trace('mail', "GET {$endpoint}", ['type' => $type], null, $e);
            throw $e;
        }
        return $resp->json();
    }

    public function removeSuppression(string $email, string $type): void
    {
        $endpoint = match ($type) {
            'bounce' => "/suppression/bounces/{$email}",
            'spam' => "/suppression/spam_reports/{$email}",
            'unsubscribe' => "/asm/suppressions/global/{$email}",
            'invalid' => "/suppression/invalid_emails/{$email}",
            'block' => "/suppression/blocks/{$email}",
            default => "/suppression/bounces/{$email}",
        };
        try {
            $resp = $this->http()->delete($endpoint);
            $resp->throw();
            DebugLogger::trace('mail', "DELETE {$endpoint}", ['email' => $email, 'type' => $type], ['status' => $resp->status()]);
        } catch (\Throwable $e) {
            DebugLogger::trace('mail', "DELETE {$endpoint}", ['email' => $email, 'type' => $type], null, $e);
            throw $e;
        }
    }

    /**
     * Verify SendGrid Event Webhook signature (ECDSA over public key from
     * the SendGrid dashboard). Pass the raw body, the signature header,
     * and the timestamp header.
     */
    public function verifyEventSignature(string $rawBody, string $signature, string $timestamp): bool
    {
        $config = MailConfig::active();
        $publicKey = $config?->webhook_verify_key ?? env('SENDGRID_WEBHOOK_VERIFY_KEY');
        if (!$publicKey) return false;

        // SendGrid expects `timestamp + payload` to be hashed/verified.
        $signedPayload = $timestamp . $rawBody;
        $decodedSig = base64_decode($signature, true);
        if ($decodedSig === false) return false;

        // Public key is base64-encoded ECDSA pubkey from dashboard. Wrap as PEM.
        $pem = "-----BEGIN PUBLIC KEY-----\n" .
            chunk_split(trim($publicKey), 64, "\n") .
            "-----END PUBLIC KEY-----\n";

        $key = openssl_pkey_get_public($pem);
        if (!$key) return false;
        $verified = openssl_verify($signedPayload, $decodedSig, $key, OPENSSL_ALGO_SHA256);
        return $verified === 1;
    }
}
