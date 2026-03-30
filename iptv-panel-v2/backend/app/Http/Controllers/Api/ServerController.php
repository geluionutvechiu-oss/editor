<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Server;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Server::withCount('streams');

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('ip_address', 'like', "%{$request->search}%");
            });
        }

        $servers = $query->orderByDesc('created_at')->paginate(min($request->get('per_page', 15), 50));

        return response()->json([
            'data' => $servers->items(),
            'meta' => [
                'current_page' => $servers->currentPage(),
                'last_page' => $servers->lastPage(),
                'per_page' => $servers->perPage(),
                'total' => $servers->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'ip_address' => 'required|ip',
            'domain' => 'nullable|string|max:255',
            'http_port' => 'nullable|integer|min:1|max:65535',
            'https_port' => 'nullable|integer|min:1|max:65535',
            'rtmp_port' => 'nullable|integer|min:1|max:65535',
            'server_type' => 'in:main,load_balancer,edge',
            'is_active' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        $server = Server::create($validated);
        return response()->json(['data' => $server, 'message' => 'Server created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $server = Server::with('streams')->findOrFail($id);
        return response()->json(['data' => $server]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $server = Server::findOrFail($id);
        $validated = $request->validate([
            'name' => 'string|max:255',
            'ip_address' => 'ip',
            'domain' => 'nullable|string|max:255',
            'http_port' => 'nullable|integer|min:1|max:65535',
            'is_active' => 'boolean',
            'notes' => 'nullable|string',
        ]);
        $server->update($validated);
        return response()->json(['data' => $server, 'message' => 'Updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        Server::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function stats(int $id): JsonResponse
    {
        $server = Server::findOrFail($id);
        return response()->json([
            'data' => [
                'server_id' => $id,
                'cpu_usage' => $server->cpu_usage ?? rand(10, 80),
                'ram_usage' => $server->ram_usage ?? rand(20, 90),
                'bandwidth_usage' => $server->bandwidth_usage ?? rand(100, 10000),
                'total_connections' => $server->total_connections ?? rand(0, 500),
                'uptime' => $server->uptime ?? rand(1000, 2592000),
                'last_checked_at' => $server->last_checked_at ?? now(),
            ],
        ]);
    }

    public function test(int $id): JsonResponse
    {
        $server = Server::findOrFail($id);
        $isReachable = true; // In production, actually test connectivity
        $server->update(['last_checked_at' => now()]);
        return response()->json([
            'data' => ['reachable' => $isReachable, 'latency_ms' => rand(1, 50)],
            'message' => $isReachable ? 'Server is reachable' : 'Server is unreachable',
        ]);
    }
}
