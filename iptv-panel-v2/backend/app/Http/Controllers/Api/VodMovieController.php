<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VodMovie;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VodMovieController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = VodMovie::with('category');

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        $query->orderBy($request->get('sort_by', 'created_at'), $request->get('sort_dir', 'desc'));
        $movies = $query->paginate(min($request->get('per_page', 25), 200));

        return response()->json([
            'data' => $movies->items(),
            'meta' => [
                'current_page' => $movies->currentPage(),
                'last_page' => $movies->lastPage(),
                'per_page' => $movies->perPage(),
                'total' => $movies->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'cover' => 'nullable|url',
            'description' => 'nullable|string',
            'trailer_url' => 'nullable|url',
            'category_id' => 'nullable|exists:vod_categories,id',
            'stream_source' => 'required|array|min:1',
            'is_active' => 'boolean',
            'release_year' => 'nullable|integer|min:1900|max:2100',
            'director' => 'nullable|string|max:255',
            'cast' => 'nullable|array',
            'genre' => 'nullable|array',
            'rating' => 'nullable|numeric|min:0|max:10',
            'duration' => 'nullable|integer',
            'language' => 'nullable|string|max:10',
        ]);

        $movie = VodMovie::create($validated);
        $movie->load('category');

        return response()->json(['data' => $movie, 'message' => 'Movie created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $movie = VodMovie::with('category')->findOrFail($id);
        return response()->json(['data' => $movie]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $movie = VodMovie::findOrFail($id);
        $validated = $request->validate([
            'name' => 'string|max:255',
            'cover' => 'nullable|url',
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:vod_categories,id',
            'stream_source' => 'nullable|array',
            'is_active' => 'boolean',
            'release_year' => 'nullable|integer|min:1900|max:2100',
            'rating' => 'nullable|numeric|min:0|max:10',
        ]);
        $movie->update($validated);
        return response()->json(['data' => $movie->fresh('category'), 'message' => 'Updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        VodMovie::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    public function bulkAction(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:vod_movies,id',
            'action' => 'required|in:activate,deactivate,delete',
        ]);

        $movies = VodMovie::whereIn('id', $validated['ids']);
        match ($validated['action']) {
            'activate' => $movies->update(['is_active' => true]),
            'deactivate' => $movies->update(['is_active' => false]),
            'delete' => $movies->delete(),
        };

        return response()->json(['message' => 'Bulk action performed', 'affected' => count($validated['ids'])]);
    }
}
