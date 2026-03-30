<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class VodMovie extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'vod_movies';

    protected $fillable = [
        'name', 'cover', 'description', 'trailer_url',
        'category_id', 'stream_source', 'is_active',
        'release_year', 'director', 'cast', 'genre',
        'rating', 'duration', 'language', 'server_id',
    ];

    protected $casts = [
        'stream_source' => 'array',
        'cast' => 'array',
        'genre' => 'array',
        'is_active' => 'boolean',
        'rating' => 'decimal:1',
    ];

    public function category(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(VodCategory::class, 'category_id');
    }
}
