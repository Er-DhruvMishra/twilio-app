<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('contact_id')->nullable()->index();
            $table->string('twilio_message_sid', 64)->nullable()->unique();
            $table->enum('direction', ['inbound', 'outbound']);
            $table->string('from_e164', 32);
            $table->string('to_e164', 32);
            $table->text('body')->nullable();
            $table->unsignedTinyInteger('num_media')->default(0);
            $table->enum('status', [
                'queued', 'sending', 'sent', 'delivered',
                'undelivered', 'failed', 'received', 'read'
            ])->default('queued');
            $table->string('error_code', 16)->nullable();
            $table->string('error_message')->nullable();
            $table->string('thread_key', 80)->index();
            $table->boolean('is_read')->default(false);
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'thread_key', 'created_at']);
            $table->index(['user_id', 'direction', 'status']);
        });

        Schema::create('message_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->string('content_type', 64);
            $table->text('media_url');
            $table->string('local_path')->nullable();
            $table->unsignedInteger('size_bytes')->nullable();
            $table->timestamps();
        });

        Schema::create('sms_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('body');
            $table->json('variables')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'name']);
        });

        Schema::create('bulk_sms_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('template_id')->nullable()->constrained('sms_templates')->nullOnDelete();
            $table->string('name');
            $table->enum('status', ['draft', 'queued', 'running', 'completed', 'failed', 'canceled'])->default('draft');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('total_recipients')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->timestamps();
        });

        Schema::create('bulk_sms_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('bulk_sms_campaigns')->cascadeOnDelete();
            $table->unsignedBigInteger('contact_id')->nullable()->index();
            $table->string('phone_e164', 32);
            $table->text('merged_body');
            $table->foreignId('message_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->enum('status', ['pending', 'queued', 'sent', 'delivered', 'failed', 'skipped'])->default('pending');
            $table->string('error_code', 16)->nullable();
            $table->timestamps();
            $table->index(['campaign_id', 'status']);
        });

        Schema::create('auto_reply_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->enum('match_type', ['always', 'keyword', 'outside_hours', 'first_contact']);
            $table->json('match_value')->nullable();
            $table->text('body');
            $table->boolean('is_enabled')->default(true);
            $table->unsignedSmallInteger('priority')->default(100);
            $table->timestamps();
            $table->index(['user_id', 'is_enabled', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auto_reply_rules');
        Schema::dropIfExists('bulk_sms_recipients');
        Schema::dropIfExists('bulk_sms_campaigns');
        Schema::dropIfExists('sms_templates');
        Schema::dropIfExists('message_media');
        Schema::dropIfExists('messages');
    }
};
