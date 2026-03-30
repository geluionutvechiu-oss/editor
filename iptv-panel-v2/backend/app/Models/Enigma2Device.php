<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Enigma2Device extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'mac_address', 'owner_id', 'reseller_id', 'package_id',
        'bouquet_ids', 'is_active', 'expires_at', 'notes',
        'last_seen_at', 'ip_address', 'device_model',
    ];

    protected $casts = [
        'bouquet_ids' => 'array',
        'is_active' => 'boolean',
        'expires_at' => 'datetime',
        'last_seen_at' => 'datetime',
    ];

    public function owner(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function package(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Package::class);
    }
}
