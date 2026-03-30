<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bouquet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BouquetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Bouquet::withCount('streams');

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        $query->orderBy('sort_order')->orderBy('name');
        $bouquets = $query->paginate(min($request->get('per_page', 25), 200));

        return response()->json([
            'data' => $bouquets->items(),
            'meta' => [
                'current_page' => $bouquets->currentPage(),
                'last_page' => $bouquets->lastPage(),
                'per_page' => $bouquets->perPage(),
                'total' => $bouquets->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'type' => 'in:live,movie,series,mixed',
            'sort_order' => 'nullable|integer',
        ]);

        $bouquet = Bouquet::create($validated);
        return response()->json(['data' => $bouquet, 'message' => 'Bouquet created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $bouquet = Bouquet::with('streams')->findOrFail($id);
        return response()->json(['data' => $bouquet]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $bouquet = Bouquet::findOrFail($id);
        $validated = $request->validate([
            'name' => 'string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'type' => 'in:live,movie,series,mixed',
            'sort_order' => 'nullable|integer',
        ]);
        $bouquet->update($validated);
        return response()->json(['data' => $bouquet, 'message' => 'Updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        Bouquet::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function addStreams(Request $request, int $id): JsonResponse
    {
        $bouquet = Bouquet::findOrFail($id);
        $validated = $request->validate([
            'stream_ids' => 'required|array',
            'stream_ids.*' => 'integer|exists:streams,id',
        ]);
        $bouquet->streams()->syncWithoutDetaching($validated['stream_ids']);
        return response()->json(['message' => 'Streams added to bouquet']);
    }

    public function removeStreams(Request $request, int $id): JsonResponse
    {
        $bouquet = Bouquet::findOrFail($id);
        $validated = $request->validate([
            'stream_ids' => 'required|array',
            'stream_ids.*' => 'integer|exists:streams,id',
        ]);
        $bouquet->streams()->detach($validated['stream_ids']);
        return response()->json(['message' => 'Streams removed from bouquet']);
    }
}
