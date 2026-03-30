<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SubscriptionLine extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'username', 'password', 'owner_id', 'reseller_id', 'package_id',
        'bouquet_ids', 'max_connections', 'is_active', 'is_trial',
        'expires_at', 'notes', 'last_activity_at', 'current_ip',
        'isp', 'country_code', 'allowed_ips',
    ];

    protected $casts = [
        'bouquet_ids' => 'array',
        'allowed_ips' => 'array',
        'is_active' => 'boolean',
        'is_trial' => 'boolean',
        'expires_at' => 'datetime',
        'last_activity_at' => 'datetime',
    ];

    public function owner(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function reseller(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'reseller_id');
    }

    public function package(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Package::class);
    }

    public function liveConnections(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(LiveConnection::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }
}
