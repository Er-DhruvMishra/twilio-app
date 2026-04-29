<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('display_name');
            $table->string('phone_e164', 32);
            $table->string('phone_normalized', 32)->index();
            $table->string('email')->nullable();
            $table->text('notes')->nullable();
            $table->string('avatar_path')->nullable();
            $table->boolean('is_blocked')->default(false);
            $table->boolean('is_favorite')->default(false);
            $table->enum('source', ['manual', 'import', 'inbound'])->default('manual');
            $table->timestamps();

            $table->unique(['user_id', 'phone_e164']);
            $table->index(['user_id', 'phone_normalized']);
            $table->index(['user_id', 'display_name']);
        });

        Schema::create('contact_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color', 16)->default('#64748b');
            $table->timestamps();
            $table->unique(['user_id', 'name']);
        });

        Schema::create('contact_tag', function (Blueprint $table) {
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_tag_id')->constrained('contact_tags')->cascadeOnDelete();
            $table->primary(['contact_id', 'contact_tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_tag');
        Schema::dropIfExists('contact_tags');
        Schema::dropIfExists('contacts');
    }
};
