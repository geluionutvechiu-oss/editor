<?php

namespace Database\Seeders;

use App\Models\Server;
use Illuminate\Database\Seeder;

class ServerSeeder extends Seeder
{
    public function run(): void
    {
        $servers = [
            ['name' => 'Main Server US', 'ip_address' => '192.168.1.10', 'domain' => 'us1.iptv.local', 'http_port' => 8080, 'server_type' => 'main', 'is_active' => true, 'cpu_usage' => 45.5, 'ram_usage' => 62.3],
            ['name' => 'Main Server EU', 'ip_address' => '192.168.1.11', 'domain' => 'eu1.iptv.local', 'http_port' => 8080, 'server_type' => 'main', 'is_active' => true, 'cpu_usage' => 38.2, 'ram_usage' => 55.1],
            ['name' => 'Edge Server Asia', 'ip_address' => '192.168.1.12', 'domain' => 'as1.iptv.local', 'http_port' => 8080, 'server_type' => 'edge', 'is_active' => true, 'cpu_usage' => 22.0, 'ram_usage' => 41.7],
            ['name' => 'Load Balancer', 'ip_address' => '192.168.1.1', 'domain' => 'lb.iptv.local', 'http_port' => 80, 'server_type' => 'load_balancer', 'is_active' => true, 'cpu_usage' => 15.0, 'ram_usage' => 25.4],
        ];

        foreach ($servers as $server) {
            Server::firstOrCreate(['name' => $server['name']], $server);
        }
    }
}
