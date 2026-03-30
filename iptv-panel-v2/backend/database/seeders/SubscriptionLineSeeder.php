<?php

namespace Database\Seeders;

use App\Models\SubscriptionLine;
use App\Models\User;
use App\Models\Package;
use App\Models\Bouquet;
use Illuminate\Database\Seeder;

class SubscriptionLineSeeder extends Seeder
{
    public function run(): void
    {
        $reseller = User::where('role', 'reseller')->first();
        $package = Package::where('name', 'Standard')->first();
        $bouquet = Bouquet::where('name', 'All Channels')->first();

        $users = User::where('role', 'user')->get();

        foreach ($users as $i => $user) {
            SubscriptionLine::firstOrCreate(
                ['username' => 'line_' . $user->id],
                [
                    'password' => 'pass' . $user->id,
                    'owner_id' => $user->id,
                    'reseller_id' => $reseller?->id,
                    'package_id' => $package?->id,
                    'bouquet_ids' => [$bouquet?->id],
                    'max_connections' => 2,
                    'is_active' => true,
                    'expires_at' => now()->addDays(rand(10, 365)),
                ]
            );
        }
    }
}
