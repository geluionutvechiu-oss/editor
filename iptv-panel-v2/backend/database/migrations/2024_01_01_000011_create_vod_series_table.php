<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vod_series', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('cover')->nullable();
            $table->text('description')->nullable();
            $table->string('trailer_url')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('vod_categories')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->integer('release_year')->nullable();
            $table->json('genre')->nullable();
            $table->decimal('rating', 3, 1)->nullable();
            $table->string('language', 10)->nullable();
            $table->json('cast')->nullable();
            $table->string('director')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vod_series');
    }
};
