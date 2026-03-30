<?php

namespace Database\Seeders;

use App\Models\Bouquet;
use App\Models\Stream;
use Illuminate\Database\Seeder;

class BouquetSeeder extends Seeder
{
    public function run(): void
    {
        $bouquets = [
            ['name' => 'Basic Channels', 'type' => 'live', 'sort_order' => 1],
            ['name' => 'Sports Pack', 'type' => 'live', 'sort_order' => 2],
            ['name' => 'News Pack', 'type' => 'live', 'sort_order' => 3],
            ['name' => 'Entertainment Pack', 'type' => 'live', 'sort_order' => 4],
            ['name' => 'All Channels', 'type' => 'mixed', 'sort_order' => 5],
        ];

        foreach ($bouquets as $bouquetData) {
            $bouquet = Bouquet::firstOrCreate(
                ['name' => $bouquetData['name']],
                array_merge($bouquetData, ['is_active' => true])
            );
        }

        // Attach all streams to "All Channels" bouquet
        $allChannels = Bouquet::where('name', 'All Channels')->first();
        if ($allChannels) {
            $streamIds = Stream::pluck('id')->toArray();
            $allChannels->streams()->syncWithoutDetaching(
                collect($streamIds)->mapWithKeys(fn($id, $i) => [$id => ['sort_order' => $i + 1]])->toArray()
            );
        }
    }
}
