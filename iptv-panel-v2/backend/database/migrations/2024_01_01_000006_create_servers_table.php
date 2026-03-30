<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('servers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('ip_address');
            $table->string('domain')->nullable();
            $table->integer('http_port')->default(8080);
            $table->integer('https_port')->nullable();
            $table->integer('rtmp_port')->nullable();
            $table->enum('server_type', ['main', 'load_balancer', 'edge'])->default('main');
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->decimal('cpu_usage', 5, 2)->nullable();
            $table->decimal('ram_usage', 5, 2)->nullable();
            $table->decimal('bandwidth_usage', 15, 2)->nullable();
            $table->bigInteger('uptime')->nullable();
            $table->integer('total_connections')->default(0);
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('servers');
    }
};
