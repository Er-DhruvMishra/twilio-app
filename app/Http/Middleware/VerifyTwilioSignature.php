<?php

namespace App\Http\Middleware;

use App\Models\TwilioConfig;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Twilio\Security\RequestValidator;

class VerifyTwilioSignature
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!env('TWILIO_VALIDATE_SIGNATURE', true)) {
            return $next($request);
        }

        $config = TwilioConfig::active();
        if (!$config?->auth_token_enc) {
            abort(503, 'Twilio not configured');
        }

        $signature = $request->header('X-Twilio-Signature', '');
        $url = $request->fullUrl();
        $params = $request->isMethod('POST') ? $request->all() : [];

        $validator = new RequestValidator($config->auth_token_enc);
        if (!$validator->validate($signature, $url, $params)) {
            abort(403, 'Invalid Twilio signature');
        }

        return $next($request);
    }
}
