<?php

namespace App\Http\Middleware;

use App\Services\Fax\FaxPlusService;
use Closure;
use Illuminate\Http\Request;

class VerifyFaxPlusSignature
{
    public function __construct(private FaxPlusService $service) {}

    public function handle(Request $request, Closure $next)
    {
        if (env('FAXPLUS_VALIDATE_SIGNATURE', true) === false) {
            return $next($request);
        }

        $signature = $request->header('X-Faxplus-Signature') ?? $request->header('X-Signature') ?? '';
        $body = $request->getContent();
        if (!$signature || !$this->service->verifySignature($body, $signature)) {
            abort(403, 'Invalid fax.plus signature');
        }
        return $next($request);
    }
}
