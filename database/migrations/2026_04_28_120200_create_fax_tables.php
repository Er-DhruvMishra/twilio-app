<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('fax_configs', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->text('api_token')->nullable();
            $t->text('webhook_signing_key')->nullable();
            $t->string('from_number', 32)->nullable();
            $t->string('account_id', 64)->nullable();
            $t->boolean('is_active')->default(false);
            $t->timestamp('verified_at')->nullable();
            $t->timestamps();
        });

        Schema::create('faxes', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $t->enum('direction', ['inbound', 'outbound']);
            $t->string('from_e164', 32)->nullable();
            $t->string('to_e164', 32)->nullable();
            $t->unsignedSmallInteger('num_pages')->default(0);
            $t->enum('status', ['queued', 'in_progress', 'success', 'failed', 'partially_successful', 'canceled'])->default('queued');
            $t->string('error_code', 64)->nullable();
            $t->string('error_message', 255)->nullable();
            $t->string('fax_plus_id', 80)->nullable()->unique();
            $t->string('document_path', 255)->nullable();
            $t->boolean('is_read')->default(false);
            $t->unsignedInteger('cost_cents')->default(0);
            $t->timestamp('started_at')->nullable();
            $t->timestamp('ended_at')->nullable();
            $t->json('payload')->nullable();
            $t->timestamps();

            $t->index(['user_id', 'started_at']);
            $t->index(['user_id', 'direction', 'status']);
        });

        Schema::create('fax_documents', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('fax_id')->constrained()->cascadeOnDelete();
            $t->string('original_name', 255);
            $t->string('local_path', 255);
            $t->unsignedInteger('size_bytes')->default(0);
            $t->unsignedSmallInteger('pages')->default(0);
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fax_documents');
        Schema::dropIfExists('faxes');
        Schema::dropIfExists('fax_configs');
    }
};
