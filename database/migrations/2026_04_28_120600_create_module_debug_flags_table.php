<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per module with an on/off toggle. Flipping any flag streams
 * request/response pairs for that module's Twilio (or partner) API calls
 * to storage/logs/module-debug.log.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('module_debug_flags', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('module', 32)->unique();
            $t->boolean('enabled')->default(false);
            $t->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('module_debug_flags');
    }
};
