<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class VodSeries extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'vod_series';

    protected $fillable = [
        'name', 'cover', 'description', 'trailer_url',
        'category_id', 'is_active', 'release_year',
        'genre', 'rating', 'language', 'cast', 'director',
    ];

    protected $casts = [
        'genre' => 'array',
        'cast' => 'array',
        'is_active' => 'boolean',
        'rating' => 'decimal:1',
    ];

    public function episodes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(VodEpisode::class, 'series_id');
    }

    public function category(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(VodCategory::class, 'category_id');
    }
}
