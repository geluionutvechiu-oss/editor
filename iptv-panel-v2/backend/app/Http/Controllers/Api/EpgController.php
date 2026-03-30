<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EpgSource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EpgController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = EpgSource::query();

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        $sources = $query->orderByDesc('created_at')->paginate(min($request->get('per_page', 15), 50));

        return response()->json([
            'data' => $sources->items(),
            'meta' => [
                'current_page' => $sources->currentPage(),
                'last_page' => $sources->lastPage(),
                'per_page' => $sources->perPage(),
                'total' => $sources->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'url' => 'required|url',
            'is_active' => 'boolean',
            'sync_interval_hours' => 'nullable|integer|min:1|max:168',
            'notes' => 'nullable|string',
        ]);

        $source = EpgSource::create($validated);
        return response()->json(['data' => $source, 'message' => 'EPG source created'], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $source = EpgSource::findOrFail($id);
        $validated = $request->validate([
            'name' => 'string|max:255',
            'url' => 'url',
            'is_active' => 'boolean',
            'sync_interval_hours' => 'nullable|integer|min:1|max:168',
        ]);
        $source->update($validated);
        return response()->json(['data' => $source, 'message' => 'Updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        EpgSource::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function sync(int $id): JsonResponse
    {
        $source = EpgSource::findOrFail($id);
        // In production, dispatch a sync job
        $source->update(['last_synced_at' => now()]);
        return response()->json(['data' => $source, 'message' => 'EPG sync initiated']);
    }
}
