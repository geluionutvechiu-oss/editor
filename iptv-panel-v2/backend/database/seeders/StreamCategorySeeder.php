<?php

namespace Database\Seeders;

use App\Models\StreamCategory;
use Illuminate\Database\Seeder;

class StreamCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            'News', 'Sports', 'Entertainment', 'Movies', 'Documentary',
            'Kids', 'Music', 'Science', 'Travel', 'Cooking',
        ];

        foreach ($categories as $i => $name) {
            StreamCategory::firstOrCreate(
                ['name' => $name],
                ['is_active' => true, 'sort_order' => $i + 1]
            );
        }
    }
}
