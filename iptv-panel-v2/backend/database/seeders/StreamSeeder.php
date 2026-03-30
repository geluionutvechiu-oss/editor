<?php

namespace Database\Seeders;

use App\Models\Stream;
use App\Models\StreamCategory;
use App\Models\Server;
use Illuminate\Database\Seeder;

class StreamSeeder extends Seeder
{
    public function run(): void
    {
        $server = Server::first();
        $newsCategory = StreamCategory::where('name', 'News')->first();
        $sportsCategory = StreamCategory::where('name', 'Sports')->first();
        $entertainmentCategory = StreamCategory::where('name', 'Entertainment')->first();

        $streams = [
            ['name' => 'CNN International', 'category_id' => $newsCategory?->id, 'status' => 'online', 'current_viewers' => 45],
            ['name' => 'BBC World News', 'category_id' => $newsCategory?->id, 'status' => 'online', 'current_viewers' => 38],
            ['name' => 'Fox News', 'category_id' => $newsCategory?->id, 'status' => 'online', 'current_viewers' => 52],
            ['name' => 'Al Jazeera English', 'category_id' => $newsCategory?->id, 'status' => 'online', 'current_viewers' => 29],
            ['name' => 'ESPN HD', 'category_id' => $sportsCategory?->id, 'status' => 'online', 'current_viewers' => 124],
            ['name' => 'beIN Sports 1', 'category_id' => $sportsCategory?->id, 'status' => 'online', 'current_viewers' => 98],
            ['name' => 'Sky Sports', 'category_id' => $sportsCategory?->id, 'status' => 'online', 'current_viewers' => 87],
            ['name' => 'NBC HD', 'category_id' => $entertainmentCategory?->id, 'status' => 'online', 'current_viewers' => 63],
            ['name' => 'HBO HD', 'category_id' => $entertainmentCategory?->id, 'status' => 'online', 'current_viewers' => 71],
            ['name' => 'Netflix Channel', 'category_id' => $entertainmentCategory?->id, 'status' => 'offline', 'current_viewers' => 0],
        ];

        foreach ($streams as $i => $streamData) {
            Stream::firstOrCreate(
                ['name' => $streamData['name']],
                array_merge($streamData, [
                    'stream_source' => ['http://stream' . ($i + 1) . '.example.com/live'],
                    'stream_type' => 'live',
                    'is_active' => true,
                    'server_id' => $server?->id,
                    'stream_order' => $i + 1,
                ])
            );
        }
    }
}
