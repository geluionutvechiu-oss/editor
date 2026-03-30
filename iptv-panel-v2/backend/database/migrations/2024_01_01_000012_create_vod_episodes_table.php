<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vod_episodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('series_id')->constrained('vod_series')->cascadeOnDelete();
            $table->integer('season');
            $table->integer('episode');
            $table->string('title');
            $table->json('stream_source');
            $table->integer('duration')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('cover')->nullable();
            $table->timestamps();

            $table->unique(['series_id', 'season', 'episode']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vod_episodes');
    }
};
