<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Twilio Lookup v2 history. One row per lookup attempt — full audit trail
 * of who/when/why we identified a number. Cache-hit logic reuses the most
 * recent row within `call_settings.lookup_cache_days`.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('lookups', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('phone_e164', 32)->index();
            $t->string('caller_name', 120)->nullable();
            $t->enum('caller_type', ['business', 'consumer'])->nullable();
            $t->string('line_type', 32)->nullable();      // mobile, landline, fixedVoip, nonFixedVoip, tollFree, voicemail
            $t->string('carrier_name', 120)->nullable();
            $t->char('country_code', 2)->nullable();
            $t->string('country_name', 64)->nullable();
            $t->boolean('is_valid')->default(true);
            $t->json('payload')->nullable();
            $t->foreignId('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->enum('source', ['manual_search', 'incoming_manual', 'incoming_auto', 'outgoing_manual', 'outgoing_auto']);
            $t->unsignedSmallInteger('cost_cents')->default(0); // tracked for billing transparency
            $t->timestamp('looked_up_at')->useCurrent();
            $t->timestamps();

            $t->index(['phone_e164', 'looked_up_at']);
            $t->index(['requested_by_user_id', 'looked_up_at']);
            $t->index(['source', 'looked_up_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lookups');
    }
};
