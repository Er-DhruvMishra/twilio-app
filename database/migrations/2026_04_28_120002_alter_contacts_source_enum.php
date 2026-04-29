<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Add `lookup` to the contacts.source enum so LookupService can upsert
 * contacts tagged as lookup-sourced. Raw SQL because Laravel's schema
 * builder can't ALTER an enum in place.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE `contacts` MODIFY COLUMN `source` ENUM('manual','import','inbound','lookup') NOT NULL DEFAULT 'manual'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE `contacts` MODIFY COLUMN `source` ENUM('manual','import','inbound') NOT NULL DEFAULT 'manual'");
    }
};
