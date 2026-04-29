<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('twilio_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('tenant_id')->nullable()->index();
            $table->text('account_sid_enc');
            $table->text('auth_token_enc');
            $table->text('api_key_sid_enc')->nullable();
            $table->text('api_key_secret_enc')->nullable();
            $table->string('twiml_app_sid')->nullable();
            $table->string('phone_number', 32)->nullable()->index();
            $table->string('phone_number_sid')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });

        Schema::create('calls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('contact_id')->nullable()->index();
            $table->string('twilio_call_sid', 64)->nullable()->unique();
            $table->string('parent_call_sid', 64)->nullable()->index();
            $table->enum('direction', ['inbound', 'outbound']);
            $table->string('from_e164', 32);
            $table->string('to_e164', 32);
            $table->enum('status', [
                'queued', 'initiated', 'ringing', 'in-progress',
                'completed', 'busy', 'failed', 'no-answer',
                'canceled', 'rejected', 'missed'
            ])->default('queued');
            $table->enum('disposition', [
                'answered', 'missed', 'rejected', 'forwarded',
                'blocked', 'voicemail', 'transferred'
            ])->nullable();
            $table->enum('tag', ['spam', 'important', 'lead'])->nullable();
            $table->string('forwarded_to_e164', 32)->nullable();
            $table->unsignedBigInteger('recording_id')->nullable()->index();
            $table->boolean('is_voicemail')->default(false);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('answered_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'started_at']);
            $table->index(['user_id', 'direction', 'status']);
        });

        Schema::create('recordings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('call_id')->constrained()->cascadeOnDelete();
            $table->string('twilio_recording_sid', 64)->unique();
            $table->text('media_url');
            $table->string('local_path')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->unsignedTinyInteger('channels')->default(1);
            $table->enum('status', ['processing', 'completed', 'failed', 'deleted'])->default('processing');
            $table->timestamps();
        });

        Schema::create('voicemails', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('call_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recording_id')->nullable()->constrained()->nullOnDelete();
            $table->text('transcript')->nullable();
            $table->timestamp('transcribed_at')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'is_read']);
        });

        Schema::create('call_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('recording_enabled')->default(false);
            $table->boolean('recording_announcement')->default(true);
            $table->string('forward_always_to', 32)->nullable();
            $table->string('forward_busy_to', 32)->nullable();
            $table->string('forward_no_answer_to', 32)->nullable();
            $table->string('forward_unreachable_to', 32)->nullable();
            $table->unsignedSmallInteger('no_answer_timeout_seconds')->default(20);
            $table->boolean('voicemail_enabled')->default(true);
            $table->string('voicemail_greeting_url')->nullable();
            $table->string('default_caller_id', 32)->nullable();
            $table->string('ringtone', 32)->default('classic');
            $table->json('simultaneous_ring_to')->nullable();
            $table->timestamps();
        });

        Schema::create('blocked_numbers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('phone_e164', 32);
            $table->enum('mode', ['blacklist', 'whitelist'])->default('blacklist');
            $table->enum('pattern_type', ['exact', 'prefix', 'country'])->default('exact');
            $table->string('pattern_value', 32)->nullable();
            $table->string('reason')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'phone_e164', 'mode']);
            $table->index(['user_id', 'mode']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blocked_numbers');
        Schema::dropIfExists('call_settings');
        Schema::dropIfExists('voicemails');
        Schema::dropIfExists('recordings');
        Schema::dropIfExists('calls');
        Schema::dropIfExists('twilio_configs');
    }
};
