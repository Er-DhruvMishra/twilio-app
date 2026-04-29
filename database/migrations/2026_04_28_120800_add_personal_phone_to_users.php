<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-user personal phone number — distinct from the Twilio number, this
 * is the agent's own line for forwarding fallbacks ("ring my mobile when
 * I miss a call"), simultaneous-ring lists, etc.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('personal_phone_e164', 32)->nullable()->after('phone_extension');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn('personal_phone_e164');
        });
    }
};
