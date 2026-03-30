<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enigma2Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class Enigma2Controller extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Enigma2Device::with(['owner', 'package']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('mac_address', 'like', "%{$search}%")
                  ->orWhereHas('owner', fn($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        $query->orderByDesc('created_at');
        $devices = $query->paginate(min($request->get('per_page', 15), 100));

        return response()->json([
            'data' => $devices->items(),
            'meta' => [
                'current_page' => $devices->currentPage(),
                'last_page' => $devices->lastPage(),
                'per_page' => $devices->perPage(),
                'total' => $devices->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mac_address' => 'required|string|unique:enigma2_devices,mac_address',
            'owner_id' => 'nullable|exists:users,id',
            'reseller_id' => 'nullable|exists:users,id',
            'package_id' => 'nullable|exists:packages,id',
            'bouquet_ids' => 'nullable|array',
            'is_active' => 'boolean',
            'expires_at' => 'nullable|date',
            'notes' => 'nullable|string',
            'device_model' => 'nullable|string|max:100',
        ]);

        $device = Enigma2Device::create($validated);
        $device->load(['owner', 'package']);

        return response()->json(['data' => $device, 'message' => 'Enigma2 device created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $device = Enigma2Device::with(['owner', 'package'])->findOrFail($id);
        return response()->json(['data' => $device]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $device = Enigma2Device::findOrFail($id);
        $validated = $request->validate([
            'mac_address' => "string|unique:enigma2_devices,mac_address,{$id}",
            'owner_id' => 'nullable|exists:users,id',
            'package_id' => 'nullable|exists:packages,id',
            'bouquet_ids' => 'nullable|array',
            'is_active' => 'boolean',
            'expires_at' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);
        $device->update($validated);
        return response()->json(['data' => $device->fresh(['owner', 'package']), 'message' => 'Updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        Enigma2Device::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }
}
