<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Package;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PackageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Package::withCount('subscriptionLines');

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        $packages = $query->orderByDesc('created_at')->paginate(min($request->get('per_page', 25), 100));

        return response()->json([
            'data' => $packages->items(),
            'meta' => [
                'current_page' => $packages->currentPage(),
                'last_page' => $packages->lastPage(),
                'per_page' => $packages->perPage(),
                'total' => $packages->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'duration_days' => 'required|integer|min:1',
            'max_connections' => 'required|integer|min:1|max:10',
            'is_active' => 'boolean',
            'is_trial' => 'boolean',
            'trial_duration_days' => 'nullable|integer|min:1',
            'features' => 'nullable|array',
        ]);

        $package = Package::create($validated);
        return response()->json(['data' => $package, 'message' => 'Package created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $package = Package::with('bouquets')->findOrFail($id);
        return response()->json(['data' => $package]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $package = Package::findOrFail($id);
        $validated = $request->validate([
            'name' => 'string|max:255',
            'description' => 'nullable|string',
            'price' => 'numeric|min:0',
            'duration_days' => 'integer|min:1',
            'max_connections' => 'integer|min:1|max:10',
            'is_active' => 'boolean',
            'features' => 'nullable|array',
        ]);
        $package->update($validated);
        return response()->json(['data' => $package, 'message' => 'Updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        Package::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
