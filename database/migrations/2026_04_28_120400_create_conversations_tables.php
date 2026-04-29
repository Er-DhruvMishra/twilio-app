<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Twilio Conversations API — shared backend for the Chat / RCS / WhatsApp /
 * Facebook Messenger sub-apps. One service, four channel-bound surfaces.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('twilio_conversation_sid', 64)->unique();
            $t->enum('channel', ['chat', 'rcs', 'whatsapp', 'facebook']);
            $t->string('friendly_name', 255)->nullable();
            $t->json('attributes')->nullable();
            $t->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('last_message_at')->nullable();
            $t->unsignedInteger('last_message_index')->default(0);
            $t->unsignedInteger('unread_count_for_owner')->default(0);
            $t->enum('state', ['active', 'inactive', 'closed'])->default('active');
            $t->timestamps();

            $t->index(['channel', 'owner_user_id', 'last_message_at']);
        });

        Schema::create('conversation_participants', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $t->string('twilio_participant_sid', 64)->unique();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('identity', 120)->nullable();
            $t->string('channel_address', 255)->nullable();
            $t->enum('role', ['admin', 'participant', 'observer'])->default('participant');
            $t->unsignedInteger('last_read_message_index')->default(0);
            $t->timestamp('joined_at')->nullable();
            $t->timestamp('left_at')->nullable();
            $t->timestamps();
        });

        Schema::create('conversation_messages', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $t->string('twilio_message_sid', 64)->unique();
            $t->unsignedInteger('twilio_index')->default(0);
            $t->string('author_identity', 120)->nullable();
            $t->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->text('body')->nullable();
            $t->unsignedSmallInteger('num_media')->default(0);
            $t->json('attributes')->nullable();
            $t->enum('delivery_status', ['queued', 'sent', 'delivered', 'read', 'failed'])->default('sent');
            $t->string('error_code', 64)->nullable();
            $t->timestamp('sent_at')->nullable();
            $t->timestamps();

            $t->index(['conversation_id', 'twilio_index']);
        });

        Schema::create('conversation_media', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('message_id')->constrained('conversation_messages')->cascadeOnDelete();
            $t->string('twilio_media_sid', 64)->nullable();
            $t->string('content_type', 120);
            $t->unsignedInteger('size_bytes')->default(0);
            $t->string('filename', 255)->nullable();
            $t->string('local_path', 255)->nullable();
            $t->timestamps();
        });

        Schema::create('conversations_configs', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('service_sid', 64)->nullable();
            $t->string('rcs_agent_sid', 80)->nullable();
            $t->string('whatsapp_from', 32)->nullable();
            $t->string('facebook_page_id', 120)->nullable();
            $t->boolean('chat_enabled')->default(true);
            $t->boolean('rcs_enabled')->default(false);
            $t->boolean('whatsapp_enabled')->default(false);
            $t->boolean('facebook_enabled')->default(false);
            $t->boolean('is_active')->default(false);
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversations_configs');
        Schema::dropIfExists('conversation_media');
        Schema::dropIfExists('conversation_messages');
        Schema::dropIfExists('conversation_participants');
        Schema::dropIfExists('conversations');
    }
};
