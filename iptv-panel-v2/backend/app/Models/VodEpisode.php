<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VodEpisode extends Model
{
    use HasFactory;

    protected $fillable = [
        'series_id', 'season', 'episode', 'title',
        'stream_source', 'duration', 'is_active', 'cover',
    ];

    protected $casts = [
        'stream_source' => 'array',
        'is_active' => 'boolean',
    ];

    public function series(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(VodSeries::class, 'series_id');
    }
}
