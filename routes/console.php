<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Refresh Twilio billing snapshot every 6 hours so the Billing dashboard
// renders without burning a live API call on every page load.
Schedule::command('billing:snapshot')->everySixHours()->withoutOverlapping();
