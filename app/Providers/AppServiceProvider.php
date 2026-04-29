<?php

namespace App\Providers;

use App\Console\NgrokProcessBuilder;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use JnJairo\Laravel\Ngrok\NgrokProcessBuilder as PackageNgrokProcessBuilder;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PackageNgrokProcessBuilder::class, fn ($app) => new NgrokProcessBuilder($app->basePath()));
    }

    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // Force https URLs when reachable through a TLS proxy (ngrok, prod CDN, etc.)
        // so Twilio signature reconstruction matches the URL Twilio signed against.
        if (request()->isSecure() || str_starts_with(config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        // Webhook rate limiter: Twilio retries can burst, but we need to limit attackers.
        RateLimiter::for('webhooks', function (Request $request) {
            return [
                Limit::perMinute(600)->by($request->ip()),
                Limit::perMinute(2000),
            ];
        });
    }
}
