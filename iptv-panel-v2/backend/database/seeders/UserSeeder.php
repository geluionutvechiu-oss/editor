<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Create admin
        User::firstOrCreate(
            ['email' => 'admin@iptv.local'],
            [
                'name' => 'Administrator',
                'password' => bcrypt('admin123'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );

        // Create reseller
        $reseller = User::firstOrCreate(
            ['email' => 'reseller@iptv.local'],
            [
                'name' => 'Demo Reseller',
                'password' => bcrypt('reseller123'),
                'role' => 'reseller',
                'is_active' => true,
                'credits' => 100.00,
                'phone' => '+1234567890',
                'country' => 'US',
            ]
        );

        // Create demo users
        for ($i = 1; $i <= 5; $i++) {
            User::firstOrCreate(
                ['email' => "user{$i}@iptv.local"],
                [
                    'name' => "Demo User {$i}",
                    'password' => bcrypt('user123'),
                    'role' => 'user',
                    'is_active' => true,
                    'reseller_id' => $reseller->id,
                ]
            );
        }
    }
}
