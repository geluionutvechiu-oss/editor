<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('package_bouquets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('package_id')->constrained('packages')->cascadeOnDelete();
            $table->foreignId('bouquet_id')->constrained('bouquets')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['package_id', 'bouquet_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('package_bouquets');
    }
};
