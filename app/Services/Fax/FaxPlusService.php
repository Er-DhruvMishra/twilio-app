<?php

namespace App\Services\Fax;

use App\Models\FaxConfig;
use App\Services\Debug\DebugLogger;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * fax.plus REST API v3 client. Twilio Programmable Fax was End-of-Life on
 * 2021-12-17; fax.plus is Twilio's named successor partner.
 *
 * API base: https://restapi.fax.plus/api/v3/
 * Auth: Bearer token (long-lived API token from fax.plus dashboard).
 */
class FaxPlusService
{
    public const BASE = 'https://restapi.fax.plus/api/v3';

    private function http(): PendingRequest
    {
        $config = FaxConfig::active();
        $token = $config?->api_token ?? config('services.faxplus.api_token', env('FAXPLUS_API_TOKEN'));
        if (!$token) {
            throw new \RuntimeException('fax.plus API token not configured.');
        }
        return Http::withToken($token)->baseUrl(self::BASE)->acceptJson()->timeout(30);
    }

    /** Upload a PDF to the outbox and return the upload reference. */
    public function uploadFile(string $localPath, string $filename): string
    {
        $req = ['name' => $filename, 'origin' => 'api', 'type' => 'fax', '_filesize' => filesize($localPath) ?: 0];
        try {
            $resp = $this->http()
                ->attach('file', file_get_contents($localPath), $filename)
                ->post('/accounts/self/uploads', $req);
            $resp->throw();
            $payload = $resp->json();
            DebugLogger::trace('fax', 'POST /accounts/self/uploads', $req, ['status' => $resp->status(), 'body' => $payload]);
        } catch (\Throwable $e) {
            DebugLogger::trace('fax', 'POST /accounts/self/uploads', $req, null, $e);
            throw $e;
        }
        return (string) ($payload['id'] ?? $payload['upload_id'] ?? $payload['file_id'] ?? '');
    }

    /** Submit a fax with one or more uploaded files. */
    public function send(string $toE164, array $fileIds, ?string $fromE164 = null): array
    {
        $config = FaxConfig::active();
        $from = $fromE164 ?? $config?->from_number ?? env('FAXPLUS_FROM_NUMBER');

        $body = [
            'to' => [$toE164],
            'from' => $from,
            'files' => $fileIds,
            'options' => [
                'enhancement' => true,
                'retry' => ['count' => 2, 'delay' => 60],
            ],
        ];
        try {
            $resp = $this->http()->post('/accounts/self/outbox', $body);
            $resp->throw();
            DebugLogger::trace('fax', 'POST /accounts/self/outbox', $body, ['status' => $resp->status(), 'body' => $resp->json()]);
        } catch (\Throwable $e) {
            DebugLogger::trace('fax', 'POST /accounts/self/outbox', $body, null, $e);
            throw $e;
        }
        return $resp->json();
    }

    public function status(string $faxId): array
    {
        try {
            $resp = $this->http()->get("/accounts/self/faxes/{$faxId}");
            $resp->throw();
            DebugLogger::trace('fax', "GET /accounts/self/faxes/{$faxId}", [], ['status' => $resp->status(), 'body' => $resp->json()]);
        } catch (\Throwable $e) {
            DebugLogger::trace('fax', "GET /accounts/self/faxes/{$faxId}", [], null, $e);
            throw $e;
        }
        return $resp->json();
    }

    /** List recent faxes (sent + received) for sync. */
    public function list(string $direction = 'outbox', int $limit = 50): array
    {
        try {
            $resp = $this->http()->get("/accounts/self/{$direction}", ['limit' => $limit]);
            $resp->throw();
            DebugLogger::trace('fax', "GET /accounts/self/{$direction}", ['limit' => $limit], ['status' => $resp->status(), 'count' => count($resp->json('faxes', []))]);
        } catch (\Throwable $e) {
            DebugLogger::trace('fax', "GET /accounts/self/{$direction}", ['limit' => $limit], null, $e);
            throw $e;
        }
        return $resp->json();
    }

    /** Download the rendered PDF of a fax (sent or received). */
    public function downloadPdf(string $faxId, string $box = 'inbox'): string
    {
        try {
            $resp = $this->http()->withOptions(['stream' => false])->get("/accounts/self/{$box}/{$faxId}/file", ['format' => 'pdf']);
            $resp->throw();
            DebugLogger::trace('fax', "GET /accounts/self/{$box}/{$faxId}/file", ['format' => 'pdf'], ['status' => $resp->status(), 'bytes' => strlen($resp->body())]);
        } catch (\Throwable $e) {
            DebugLogger::trace('fax', "GET /accounts/self/{$box}/{$faxId}/file", ['format' => 'pdf'], null, $e);
            throw $e;
        }
        return $resp->body();
    }

    /**
     * Verify a webhook payload signature. fax.plus signs the raw body with
     * HMAC-SHA256 using the per-account webhook signing key.
     */
    public function verifySignature(string $rawBody, string $signature): bool
    {
        $config = FaxConfig::active();
        $key = $config?->webhook_signing_key ?? env('FAXPLUS_WEBHOOK_SIGNING_KEY');
        if (!$key) return false;
        $expected = hash_hmac('sha256', $rawBody, $key);
        return hash_equals($expected, $signature);
    }

    /** Sync our webhook URLs to the configured fax.plus account. */
    public function syncWebhooks(string $statusUrl, string $inboundUrl): array
    {
        $resp = $this->http()->put('/accounts/self/notifications', [
            'webhooks' => [
                ['type' => 'fax.outbound.completed', 'url' => $statusUrl, 'method' => 'POST'],
                ['type' => 'fax.outbound.failed', 'url' => $statusUrl, 'method' => 'POST'],
                ['type' => 'fax.inbound.received', 'url' => $inboundUrl, 'method' => 'POST'],
            ],
        ]);
        $resp->throw();
        return $resp->json();
    }
}
