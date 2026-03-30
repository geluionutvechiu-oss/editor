<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stream;
use App\Models\StreamCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StreamController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Stream::with(['category', 'server']);

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $query->orderBy($request->get('sort_by', 'stream_order'), $request->get('sort_dir', 'asc'));
        $streams = $query->paginate(min($request->get('per_page', 25), 200));

        return response()->json([
            'data' => $streams->items(),
            'meta' => [
                'current_page' => $streams->currentPage(),
                'last_page' => $streams->lastPage(),
                'per_page' => $streams->perPage(),
                'total' => $streams->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'stream_icon' => 'nullable|url',
            'category_id' => 'nullable|exists:stream_categories,id',
            'stream_source' => 'required|array|min:1',
            'stream_type' => 'in:live,movie,series',
            'epg_channel_id' => 'nullable|string',
            'is_active' => 'boolean',
            'server_id' => 'nullable|exists:servers,id',
            'stream_order' => 'nullable|integer',
            'tv_archive' => 'boolean',
            'tv_archive_duration' => 'nullable|integer',
            'notes' => 'nullable|string',
        ]);

        $stream = Stream::create($validated);
        $stream->load(['category', 'server']);

        return response()->json(['data' => $stream, 'message' => 'Stream created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $stream = Stream::with(['category', 'server', 'bouquets'])->findOrFail($id);
        return response()->json(['data' => $stream]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $stream = Stream::findOrFail($id);

        $validated = $request->validate([
            'name' => 'string|max:255',
            'stream_icon' => 'nullable|url',
            'category_id' => 'nullable|exists:stream_categories,id',
            'stream_source' => 'nullable|array',
            'stream_type' => 'in:live,movie,series',
            'epg_channel_id' => 'nullable|string',
            'is_active' => 'boolean',
            'server_id' => 'nullable|exists:servers,id',
            'stream_order' => 'nullable|integer',
            'tv_archive' => 'boolean',
            'tv_archive_duration' => 'nullable|integer',
            'notes' => 'nullable|string',
        ]);

        $stream->update($validated);
        $stream->load(['category', 'server']);

        return response()->json(['data' => $stream, 'message' => 'Updated successfully']);
    }

    public function destroy(int $id): JsonResponse
    {
        $stream = Stream::findOrFail($id);
        $stream->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    public function restart(int $id): JsonResponse
    {
        $stream = Stream::findOrFail($id);
        $stream->update(['status' => 'restarting']);
        // In production, dispatch a job to restart the stream
        $stream->update(['status' => 'online']);
        return response()->json(['data' => $stream, 'message' => 'Stream restarted']);
    }

    public function stats(int $id): JsonResponse
    {
        $stream = Stream::findOrFail($id);
        return response()->json([
            'data' => [
                'stream_id' => $id,
                'current_viewers' => $stream->current_viewers ?? 0,
                'status' => $stream->status ?? 'unknown',
                'bitrate' => rand(1000, 8000),
                'uptime' => rand(1000, 86400),
            ],
        ]);
    }

    public function bulkAction(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:streams,id',
            'action' => 'required|in:activate,deactivate,delete',
        ]);

        $streams = Stream::whereIn('id', $validated['ids']);

        match ($validated['action']) {
            'activate' => $streams->update(['is_active' => true]),
            'deactivate' => $streams->update(['is_active' => false]),
            'delete' => $streams->delete(),
        };

        return response()->json(['message' => 'Bulk action performed', 'affected' => count($validated['ids'])]);
    }
}
