<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StreamCategory extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'parent_id', 'is_active', 'sort_order'];

    protected $casts = ['is_active' => 'boolean'];

    public function streams(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Stream::class, 'category_id');
    }
}
