<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('streams', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('stream_icon')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('stream_categories')->nullOnDelete();
            $table->json('stream_source');
            $table->enum('stream_type', ['live', 'movie', 'series'])->default('live');
            $table->string('epg_channel_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('server_id')->nullable()->constrained('servers')->nullOnDelete();
            $table->integer('stream_order')->default(0);
            $table->boolean('tv_archive')->default(false);
            $table->integer('tv_archive_duration')->nullable();
            $table->string('custom_sid')->nullable();
            $table->boolean('redirect_stream')->default(false);
            $table->boolean('on_demand')->default(false);
            $table->integer('current_viewers')->default(0);
            $table->enum('status', ['online', 'offline', 'error', 'restarting'])->default('offline');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('streams');
    }
};
