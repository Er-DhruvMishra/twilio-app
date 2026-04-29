<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('video_rooms', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('twilio_room_sid', 64)->unique();
            $t->string('name', 120);
            $t->enum('type', ['group', 'group-small', 'peer-to-peer', 'go'])->default('group');
            $t->enum('status', ['in-progress', 'completed', 'failed'])->default('in-progress');
            $t->unsignedSmallInteger('max_participants')->default(50);
            $t->boolean('record_participants')->default(false);
            $t->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('started_at')->nullable();
            $t->timestamp('ended_at')->nullable();
            $t->unsignedInteger('duration_seconds')->default(0);
            $t->timestamps();

            $t->index(['created_by_user_id', 'started_at']);
            $t->index('status');
        });

        Schema::create('video_room_participants', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('room_id')->constrained('video_rooms')->cascadeOnDelete();
            $t->string('twilio_participant_sid', 64)->unique();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('identity', 120);
            $t->enum('role', ['moderator', 'participant'])->default('participant');
            $t->timestamp('joined_at')->nullable();
            $t->timestamp('left_at')->nullable();
            $t->unsignedInteger('duration_seconds')->default(0);
            $t->timestamps();
        });

        Schema::create('video_recordings', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignId('room_id')->constrained('video_rooms')->cascadeOnDelete();
            $t->foreignId('participant_id')->nullable()->constrained('video_room_participants')->nullOnDelete();
            $t->string('twilio_recording_sid', 64)->unique();
            $t->string('twilio_composition_sid', 64)->nullable();
            $t->string('status', 32)->default('processing');
            $t->enum('format', ['mka', 'mkv', 'mp4'])->default('mp4');
            $t->unsignedInteger('duration_seconds')->default(0);
            $t->unsignedBigInteger('size_bytes')->default(0);
            $t->string('media_url', 500)->nullable();
            $t->timestamps();

            $t->index('room_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('video_recordings');
        Schema::dropIfExists('video_room_participants');
        Schema::dropIfExists('video_rooms');
    }
};
