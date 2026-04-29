<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-user speed-dial slots for digit keys 1-9 on the dialer. Stored as a
 * JSON object: {"1":"+14155551212","3":"+919999900000"}. Slot "0" is
 * intentionally reserved for the long-press "+" behavior.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('call_settings', function (Blueprint $t) {
            $t->json('speed_dial_slots')->nullable()->after('lookup_cache_days');
        });
    }

    public function down(): void
    {
        Schema::table('call_settings', function (Blueprint $t) {
            $t->dropColumn('speed_dial_slots');
        });
    }
};
