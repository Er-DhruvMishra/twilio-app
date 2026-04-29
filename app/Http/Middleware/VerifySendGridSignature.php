<?php

namespace App\Http\Middleware;

use App\Services\Mail\SendGridService;
use Closure;
use Illuminate\Http\Request;

class VerifySendGridSignature
{
    public function __construct(private SendGridService $service) {}

    public function handle(Request $request, Closure $next)
    {
        if (env('SENDGRID_VALIDATE_SIGNATURE', true) === false) {
            return $next($request);
        }

        $signature = $request->header('X-Twilio-Email-Event-Webhook-Signature') ?? '';
        $timestamp = $request->header('X-Twilio-Email-Event-Webhook-Timestamp') ?? '';
        $body = $request->getContent();

        // Inbound Parse uses a different scheme (basic auth or simple URL).
        // Skip ECDSA check for inbound and accept anyone — the inbound URL
        // should be Inbound-Parse-only, never used for events.
        if ($request->is('webhooks/sendgrid/inbound')) {
            return $next($request);
        }

        if (!$signature || !$timestamp || !$this->service->verifyEventSignature($body, $signature, $timestamp)) {
            abort(403, 'Invalid SendGrid signature');
        }

        return $next($request);
    }
}
