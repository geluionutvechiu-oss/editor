<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LiveConnection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LiveConnectionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = LiveConnection::with(['subscriptionLine', 'stream']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('ip_address', 'like', "%{$search}%")
                  ->orWhereHas('subscriptionLine', fn($q) => $q->where('username', 'like', "%{$search}%"));
            });
        }

        $query->orderByDesc('connected_at');
        $connections = $query->paginate(min($request->get('per_page', 25), 200));

        return response()->json([
            'data' => $connections->items(),
            'meta' => [
                'current_page' => $connections->currentPage(),
                'last_page' => $connections->lastPage(),
                'per_page' => $connections->perPage(),
                'total' => $connections->total(),
            ],
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $connection = LiveConnection::findOrFail($id);
        $connection->delete();
        return response()->json(['message' => 'Connection terminated']);
    }

    public function kickAll(): JsonResponse
    {
        $count = LiveConnection::count();
        LiveConnection::truncate();
        return response()->json(['message' => "Kicked {$count} connections"]);
    }
}
