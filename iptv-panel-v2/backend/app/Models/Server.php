<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Server extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'ip_address', 'domain', 'http_port', 'https_port',
        'rtmp_port', 'server_type', 'is_active', 'notes',
        'cpu_usage', 'ram_usage', 'bandwidth_usage', 'uptime',
        'total_connections', 'last_checked_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'cpu_usage' => 'decimal:2',
        'ram_usage' => 'decimal:2',
        'bandwidth_usage' => 'decimal:2',
        'last_checked_at' => 'datetime',
    ];

    public function streams(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Stream::class);
    }
}
