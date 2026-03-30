<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VodCategory extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'type', 'parent_id', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
