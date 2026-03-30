<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vod_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['movie', 'series'])->default('movie');
            $table->foreignId('parent_id')->nullable()->constrained('vod_categories')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vod_categories');
    }
};
