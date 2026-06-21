<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Provider/error strings (e.g. a full Pusher/Twilio failure message) routinely
 * exceed VARCHAR(255/500) and threw SQLSTATE[22001] "Data too long for column
 * 'error_message'". Widen these columns to TEXT so a failure can always be
 * recorded instead of masking the real error with a truncation error.
 */
return new class extends Migration
{
    /** @var array<string, int> table => original VARCHAR length (for rollback) */
    private array $columns = [
        'messages' => 255,
        'faxes' => 255,
        'mails' => 500,
    ];

    public function up(): void
    {
        foreach (array_keys($this->columns) as $table) {
            if (Schema::hasColumn($table, 'error_message')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->text('error_message')->nullable()->change();
                });
            }
        }
    }

    public function down(): void
    {
        foreach ($this->columns as $table => $length) {
            if (Schema::hasColumn($table, 'error_message')) {
                Schema::table($table, function (Blueprint $t) use ($length) {
                    $t->string('error_message', $length)->nullable()->change();
                });
            }
        }
    }
};
