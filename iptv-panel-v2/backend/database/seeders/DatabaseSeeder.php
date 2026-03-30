<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            PackageSeeder::class,
            ServerSeeder::class,
            StreamCategorySeeder::class,
            StreamSeeder::class,
            BouquetSeeder::class,
            SubscriptionLineSeeder::class,
        ]);
    }
}
