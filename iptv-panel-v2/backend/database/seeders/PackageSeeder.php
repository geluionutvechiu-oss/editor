<?php

namespace Database\Seeders;

use App\Models\Package;
use Illuminate\Database\Seeder;

class PackageSeeder extends Seeder
{
    public function run(): void
    {
        $packages = [
            ['name' => 'Basic', 'description' => 'Basic IPTV package', 'price' => 9.99, 'duration_days' => 30, 'max_connections' => 1, 'is_active' => true],
            ['name' => 'Standard', 'description' => 'Standard IPTV package', 'price' => 14.99, 'duration_days' => 30, 'max_connections' => 2, 'is_active' => true],
            ['name' => 'Premium', 'description' => 'Premium IPTV package', 'price' => 19.99, 'duration_days' => 30, 'max_connections' => 3, 'is_active' => true],
            ['name' => '3 Months Basic', 'description' => '3-month basic plan', 'price' => 24.99, 'duration_days' => 90, 'max_connections' => 1, 'is_active' => true],
            ['name' => '6 Months Premium', 'description' => '6-month premium plan', 'price' => 89.99, 'duration_days' => 180, 'max_connections' => 3, 'is_active' => true],
            ['name' => 'Annual VIP', 'description' => 'Annual VIP package', 'price' => 149.99, 'duration_days' => 365, 'max_connections' => 5, 'is_active' => true],
            ['name' => '7-Day Trial', 'description' => 'Free trial', 'price' => 0, 'duration_days' => 7, 'max_connections' => 1, 'is_active' => true, 'is_trial' => true],
        ];

        foreach ($packages as $package) {
            Package::firstOrCreate(['name' => $package['name']], $package);
        }
    }
}
