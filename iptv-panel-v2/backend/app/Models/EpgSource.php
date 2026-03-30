<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EpgSource extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'url', 'is_active', 'last_synced_at', 'sync_interval_hours',
        'channel_count', 'notes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'last_synced_at' => 'datetime',
    ];
}
