<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Only seed if no users exist yet (idempotent on container restart)
        if (User::count() > 0) {
            return;
        }

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
