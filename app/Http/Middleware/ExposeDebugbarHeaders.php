<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * barryvdh/laravel-debugbar emits a family of `phpdebugbar*` response
 * headers when AJAX capture is on, and its client-side JS reads them via
 * `xhr.getResponseHeader(...)` to fold the request's debug data into the
 * floating bar. Browsers refuse to expose non-safelisted response headers
 * to JS unless the server lists them in `Access-Control-Expose-Headers` —
 * causing the `Refused to get unsafe header "phpdebugbar*"` console noise.
 *
 * This middleware appends every header it actually finds on the response
 * whose name starts with `phpdebugbar` to the expose list, plus the known
 * static set (covers cases where my middleware runs before debugbar adds
 * its own headers, depending on prepend order). No-ops in production /
 * when debugbar is disabled.
 *
 * Headers debugbar (v4.x via php-debugbar v2) writes onto the response:
 *   - phpdebugbar          payload (when storage is NOT persisted)
 *   - phpdebugbar-id       request ID (open-handler mode)
 *   - phpdebugbar-stack    queued stacked-request IDs (open-handler mode)
 *   - phpdebugbar-1..N     chunked payload when the inline JSON exceeds
 *                          4096 bytes (uncommon but happens on heavy pages)
 * See vendor/php-debugbar/php-debugbar/src/DebugBar.php::getDataAsHeaders.
 */
class ExposeDebugbarHeaders
{
    private const STATIC_EXPOSE = ['phpdebugbar', 'phpdebugbar-id', 'phpdebugbar-stack'];

    /** Generous chunk-suffix range; well above what we'll ever actually emit. */
    private const MAX_CHUNKS = 20;

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (!$this->debugbarActive()) {
            return $response;
        }

        // Start with the known static set + chunked variants.
        $expose = self::STATIC_EXPOSE;
        for ($i = 1; $i <= self::MAX_CHUNKS; $i++) {
            $expose[] = "phpdebugbar-{$i}";
        }

        // Also pick up any phpdebugbar* header actually present on this
        // response — defensive in case future debugbar versions add new
        // names. Header keys come back lower-case from Symfony's bag.
        foreach ($response->headers->keys() as $name) {
            if (str_starts_with($name, 'phpdebugbar')) {
                $expose[] = $name;
            }
        }

        $existing = (string) $response->headers->get('Access-Control-Expose-Headers', '');
        $current = array_filter(array_map('trim', explode(',', $existing)));
        $merged = array_values(array_unique(array_merge($current, $expose)));
        $response->headers->set('Access-Control-Expose-Headers', implode(', ', $merged));

        return $response;
    }

    private function debugbarActive(): bool
    {
        // Same predicate debugbar uses internally — no point exposing
        // headers when the package isn't going to set them in the first
        // place. Falls back to APP_DEBUG since DEBUGBAR_ENABLED is null
        // by default.
        $enabled = env('DEBUGBAR_ENABLED');
        if ($enabled === null) return (bool) config('app.debug');
        return filter_var($enabled, FILTER_VALIDATE_BOOLEAN);
    }
}
