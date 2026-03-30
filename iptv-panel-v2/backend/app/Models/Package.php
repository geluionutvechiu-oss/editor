<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Package extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'description', 'price', 'duration_days',
        'max_connections', 'is_active', 'is_trial',
        'trial_duration_days', 'features',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_active' => 'boolean',
        'is_trial' => 'boolean',
        'features' => 'array',
    ];

    public function bouquets(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Bouquet::class, 'package_bouquets');
    }

    public function subscriptionLines(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SubscriptionLine::class);
    }
}
