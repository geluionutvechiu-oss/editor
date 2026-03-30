<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Stream extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'stream_icon', 'category_id', 'stream_source',
        'stream_type', 'epg_channel_id', 'is_active', 'server_id',
        'stream_order', 'tv_archive', 'tv_archive_duration',
        'custom_sid', 'redirect_stream', 'on_demand',
        'current_viewers', 'status', 'notes',
    ];

    protected $casts = [
        'stream_source' => 'array',
        'is_active' => 'boolean',
        'tv_archive' => 'boolean',
        'on_demand' => 'boolean',
        'current_viewers' => 'integer',
    ];

    public function category(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(StreamCategory::class, 'category_id');
    }

    public function server(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function bouquets(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Bouquet::class, 'bouquet_streams');
    }

    public function liveConnections(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(LiveConnection::class);
    }
}
