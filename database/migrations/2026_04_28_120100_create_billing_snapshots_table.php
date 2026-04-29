<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cached Twilio billing snapshots. Cron command `billing:snapshot` writes
 * one row every 6h so the dashboard renders without burning Twilio API
 * calls on each page load.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('billing_snapshots', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->date('period_start');
            $t->date('period_end');
            $t->bigInteger('balance_cents')->default(0);
            $t->char('currency', 3)->default('USD');
            $t->json('totals')->nullable();   // per-category breakdown
            $t->json('raw')->nullable();      // full Twilio response for forensic diffs
            $t->timestamp('fetched_at')->useCurrent();
            $t->timestamps();

            $t->index(['period_start', 'period_end']);
            $t->index('fetched_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_snapshots');
    }
};
