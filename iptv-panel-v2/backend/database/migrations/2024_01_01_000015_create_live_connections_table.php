<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('live_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_line_id')->nullable()->constrained('subscription_lines')->nullOnDelete();
            $table->foreignId('stream_id')->nullable()->constrained('streams')->nullOnDelete();
            $table->string('ip_address');
            $table->text('user_agent')->nullable();
            $table->string('isp')->nullable();
            $table->string('country_code', 5)->nullable();
            $table->timestamp('connected_at');
            $table->timestamp('last_activity_at')->nullable();
            $table->bigInteger('bytes_transferred')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_connections');
    }
};
