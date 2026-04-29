<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mail module backed by Twilio SendGrid. Threads computed via In-Reply-To /
 * References headers + subject normalization. Event webhook records every
 * lifecycle event so Stats and Suppressions stay in sync.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('mail_configs', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->text('api_key')->nullable();
            $t->text('webhook_verify_key')->nullable();
            $t->string('from_email', 160)->nullable();
            $t->string('from_name', 120)->nullable();
            $t->string('inbound_host', 160)->nullable(); // e.g. parse.example.com
            $t->boolean('is_active')->default(false);
            $t->timestamp('verified_at')->nullable();
            $t->timestamps();
        });

        Schema::create('mail_threads', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('subject_normalized', 255);
            $t->json('participants')->nullable();
            $t->timestamp('last_mail_at')->nullable();
            $t->unsignedInteger('mail_count')->default(0);
            $t->unsignedInteger('unread_count')->default(0);
            $t->timestamps();

            $t->index(['user_id', 'last_mail_at']);
        });

        Schema::create('mails', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('thread_id')->nullable()->constrained('mail_threads')->nullOnDelete();
            $t->enum('direction', ['inbound', 'outbound']);
            $t->string('sg_message_id', 120)->nullable()->unique();
            $t->string('message_id_header', 255)->nullable()->index();
            $t->string('in_reply_to', 255)->nullable()->index();
            $t->string('from_email', 160);
            $t->string('from_name', 120)->nullable();
            $t->string('to_email', 255);
            $t->text('cc')->nullable();
            $t->text('bcc')->nullable();
            $t->string('subject', 500)->nullable();
            $t->longText('body_html')->nullable();
            $t->mediumText('body_text')->nullable();
            $t->json('headers')->nullable();
            $t->enum('status', ['queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'dropped', 'spam', 'blocked', 'failed'])->default('queued');
            $t->string('error_code', 64)->nullable();
            $t->string('error_message', 500)->nullable();
            $t->timestamp('opened_at')->nullable();
            $t->timestamp('clicked_at')->nullable();
            $t->timestamp('bounced_at')->nullable();
            $t->boolean('is_read')->default(false);
            $t->timestamp('sent_at')->nullable();
            $t->timestamps();

            $t->index(['user_id', 'thread_id', 'sent_at']);
            $t->index(['user_id', 'direction', 'status']);
        });

        Schema::create('mail_attachments', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('mail_id')->constrained()->cascadeOnDelete();
            $t->string('original_name', 255);
            $t->string('content_type', 120);
            $t->unsignedInteger('size_bytes')->default(0);
            $t->string('local_path', 255);
            $t->timestamps();
        });

        Schema::create('mail_templates', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('name', 120);
            $t->string('sg_template_id', 80)->nullable();
            $t->string('subject', 500);
            $t->longText('body_html');
            $t->json('variables')->nullable();
            $t->timestamp('last_synced_at')->nullable();
            $t->timestamps();
        });

        Schema::create('mail_campaigns', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('name', 120);
            $t->foreignId('template_id')->nullable()->constrained('mail_templates')->nullOnDelete();
            $t->string('subject', 500);
            $t->longText('body_html')->nullable();
            $t->enum('status', ['draft', 'queued', 'running', 'completed', 'failed', 'canceled'])->default('draft');
            $t->timestamp('scheduled_at')->nullable();
            $t->timestamp('started_at')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->unsignedInteger('total_recipients')->default(0);
            $t->unsignedInteger('sent_count')->default(0);
            $t->unsignedInteger('delivered_count')->default(0);
            $t->unsignedInteger('opened_count')->default(0);
            $t->unsignedInteger('clicked_count')->default(0);
            $t->unsignedInteger('bounced_count')->default(0);
            $t->timestamps();
        });

        Schema::create('mail_campaign_recipients', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('campaign_id')->constrained('mail_campaigns')->cascadeOnDelete();
            $t->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $t->string('email', 160);
            $t->string('merged_subject', 500)->nullable();
            $t->longText('merged_body_html')->nullable();
            $t->foreignId('mail_id')->nullable()->constrained()->nullOnDelete();
            $t->string('status', 32)->default('pending');
            $t->timestamps();
        });

        Schema::create('mail_suppressions', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('email', 160);
            $t->enum('type', ['bounce', 'spam', 'unsubscribe', 'invalid', 'block']);
            $t->string('reason', 500)->nullable();
            $t->timestamp('suppressed_at')->useCurrent();
            $t->timestamps();

            $t->unique(['email', 'type']);
        });

        Schema::create('mail_events', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('sg_message_id', 120)->index();
            $t->string('email', 160)->nullable();
            $t->string('event', 40);
            $t->timestamp('event_timestamp')->nullable();
            $t->json('payload')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mail_events');
        Schema::dropIfExists('mail_suppressions');
        Schema::dropIfExists('mail_campaign_recipients');
        Schema::dropIfExists('mail_campaigns');
        Schema::dropIfExists('mail_templates');
        Schema::dropIfExists('mail_attachments');
        Schema::dropIfExists('mails');
        Schema::dropIfExists('mail_threads');
        Schema::dropIfExists('mail_configs');
    }
};
