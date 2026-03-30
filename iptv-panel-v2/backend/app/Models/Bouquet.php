<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Bouquet extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'description', 'is_active', 'type', 'sort_order'];

    protected $casts = ['is_active' => 'boolean'];

    public function streams(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Stream::class, 'bouquet_streams')
            ->withPivot('sort_order')
            ->orderByPivot('sort_order');
    }

    public function packages(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Package::class, 'package_bouquets');
    }
}
