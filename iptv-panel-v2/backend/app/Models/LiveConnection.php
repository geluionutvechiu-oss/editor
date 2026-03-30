<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LiveConnection extends Model
{
    use HasFactory;

    protected $fillable = [
        'subscription_line_id', 'stream_id', 'ip_address',
        'user_agent', 'isp', 'country_code', 'connected_at',
        'last_activity_at', 'bytes_transferred',
    ];

    protected $casts = [
        'connected_at' => 'datetime',
        'last_activity_at' => 'datetime',
    ];

    public function subscriptionLine(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(SubscriptionLine::class);
    }

    public function stream(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Stream::class);
    }
}
