<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function () {
            Route::middleware('throttle:webhooks')
                ->group(__DIR__.'/../routes/webhooks.php');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Global so the Expose-Headers ride on EVERY response — including
        // routes outside the web group (signed URLs, asset proxies, the
        // Inertia-initiated /assets fetch on the dev server, etc).
        $middleware->append(\App\Http\Middleware\ExposeDebugbarHeaders::class);

        $middleware->validateCsrfTokens(except: [
            'webhooks/*',
        ]);

        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'twilio.signature' => \App\Http\Middleware\VerifyTwilioSignature::class,
            'faxplus.signature' => \App\Http\Middleware\VerifyFaxPlusSignature::class,
            'sendgrid.signature' => \App\Http\Middleware\VerifySendGridSignature::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
