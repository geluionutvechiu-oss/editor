<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VodSeries;
use App\Models\VodEpisode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VodSeriesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = VodSeries::with('category')->withCount('episodes');

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        $query->orderByDesc('created_at');
        $series = $query->paginate(min($request->get('per_page', 25), 200));

        return response()->json([
            'data' => $series->items(),
            'meta' => [
                'current_page' => $series->currentPage(),
                'last_page' => $series->lastPage(),
                'per_page' => $series->perPage(),
                'total' => $series->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'cover' => 'nullable|url',
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:vod_categories,id',
            'is_active' => 'boolean',
            'release_year' => 'nullable|integer',
            'genre' => 'nullable|array',
            'rating' => 'nullable|numeric|min:0|max:10',
            'language' => 'nullable|string|max:10',
        ]);

        $series = VodSeries::create($validated);
        return response()->json(['data' => $series, 'message' => 'Series created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $series = VodSeries::with(['category', 'episodes'])->findOrFail($id);
        return response()->json(['data' => $series]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $series = VodSeries::findOrFail($id);
        $validated = $request->validate([
            'name' => 'string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'rating' => 'nullable|numeric',
        ]);
        $series->update($validated);
        return response()->json(['data' => $series, 'message' => 'Updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        VodSeries::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function episodes(int $id): JsonResponse
    {
        $series = VodSeries::findOrFail($id);
        $episodes = $series->episodes()->orderBy('season')->orderBy('episode')->get();
        return response()->json(['data' => $episodes]);
    }

    public function addEpisode(Request $request, int $id): JsonResponse
    {
        VodSeries::findOrFail($id);
        $validated = $request->validate([
            'season' => 'required|integer|min:1',
            'episode' => 'required|integer|min:1',
            'title' => 'required|string|max:255',
            'stream_source' => 'required|array',
            'duration' => 'nullable|integer',
        ]);
        $validated['series_id'] = $id;
        $episode = VodEpisode::create($validated);
        return response()->json(['data' => $episode, 'message' => 'Episode added'], 201);
    }
}
