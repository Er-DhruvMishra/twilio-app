<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-user lookup automation toggles. Auto-lookup never fires for known
 * contacts — that's enforced in LookupService::shouldAutoLookup().
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('call_settings', function (Blueprint $t) {
            $t->boolean('auto_lookup_inbound')->default(false)->after('voicemail_greeting_url');
            $t->boolean('auto_lookup_outbound')->default(false)->after('auto_lookup_inbound');
            $t->unsignedSmallInteger('lookup_cache_days')->default(30)->after('auto_lookup_outbound');
        });
    }

    public function down(): void
    {
        Schema::table('call_settings', function (Blueprint $t) {
            $t->dropColumn(['auto_lookup_inbound', 'auto_lookup_outbound', 'lookup_cache_days']);
        });
    }
};
