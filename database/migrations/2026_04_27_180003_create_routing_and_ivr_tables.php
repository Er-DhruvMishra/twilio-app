<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('routing_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedSmallInteger('priority')->default(100);
            $table->boolean('is_enabled')->default(true);
            $table->enum('match_type', [
                'any', 'contact_tag', 'number_pattern',
                'time_window', 'from_country'
            ])->default('any');
            $table->json('match_value')->nullable();
            $table->enum('action', [
                'ring_user', 'simultaneous_ring', 'round_robin',
                'priority_list', 'skill_based', 'forward',
                'voicemail', 'ivr', 'queue'
            ]);
            $table->json('action_target')->nullable();
            $table->json('time_window')->nullable();
            $table->unsignedBigInteger('last_assigned_user_id')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'is_enabled', 'priority']);
        });

        Schema::create('routing_queues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('hold_music_url')->nullable();
            $table->boolean('position_announcements')->default(true);
            $table->unsignedSmallInteger('max_wait_seconds')->default(300);
            $table->enum('overflow_action', ['voicemail', 'forward', 'hangup'])->default('voicemail');
            $table->string('overflow_target', 32)->nullable();
            $table->timestamps();
        });

        Schema::create('agent_skills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('skill', 64);
            $table->unsignedTinyInteger('weight')->default(1);
            $table->timestamps();
            $table->unique(['user_id', 'skill']);
        });

        Schema::create('ivr_flows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_published')->default(false);
            $table->unsignedSmallInteger('version')->default(1);
            $table->unsignedBigInteger('entry_node_id')->nullable();
            $table->json('assigned_phone_numbers')->nullable();
            $table->timestamps();
        });

        Schema::create('ivr_nodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ivr_flow_id')->constrained()->cascadeOnDelete();
            $table->enum('type', [
                'say', 'play', 'gather', 'dial', 'record',
                'voicemail', 'hangup', 'goto', 'condition',
                'queue', 'transfer'
            ]);
            $table->json('config')->nullable();
            $table->integer('position_x')->default(0);
            $table->integer('position_y')->default(0);
            $table->timestamps();
            $table->index('ivr_flow_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ivr_nodes');
        Schema::dropIfExists('ivr_flows');
        Schema::dropIfExists('agent_skills');
        Schema::dropIfExists('routing_queues');
        Schema::dropIfExists('routing_rules');
    }
};
