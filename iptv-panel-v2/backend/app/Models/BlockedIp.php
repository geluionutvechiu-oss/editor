<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BlockedIp extends Model
{
    use HasFactory;

    protected $fillable = [
        'ip_address', 'reason', 'blocked_by', 'expires_at', 'is_permanent',
    ];

    protected $casts = [
        'is_permanent' => 'boolean',
        'expires_at' => 'datetime',
    ];

    public function blockedByUser(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'blocked_by');
    }
}
