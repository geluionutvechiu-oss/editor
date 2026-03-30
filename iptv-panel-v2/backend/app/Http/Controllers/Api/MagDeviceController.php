<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MagDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MagDeviceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = MagDevice::with(['owner', 'package']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('mac_address', 'like', "%{$search}%")
                  ->orWhereHas('owner', fn($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
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
            'mac_address' => 'required|string|unique:mag_devices,mac_address',
            'owner_id' => 'nullable|exists:users,id',
            'reseller_id' => 'nullable|exists:users,id',
            'package_id' => 'nullable|exists:packages,id',
            'bouquet_ids' => 'nullable|array',
            'is_active' => 'boolean',
            'expires_at' => 'nullable|date',
            'notes' => 'nullable|string',
            'device_model' => 'nullable|string|max:100',
        ]);

        $device = MagDevice::create($validated);
        $device->load(['owner', 'package']);

        return response()->json(['data' => $device, 'message' => 'MAG device created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $device = MagDevice::with(['owner', 'package'])->findOrFail($id);
        return response()->json(['data' => $device]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $device = MagDevice::findOrFail($id);

        $validated = $request->validate([
            'mac_address' => "string|unique:mag_devices,mac_address,{$id}",
            'owner_id' => 'nullable|exists:users,id',
            'reseller_id' => 'nullable|exists:users,id',
            'package_id' => 'nullable|exists:packages,id',
            'bouquet_ids' => 'nullable|array',
            'is_active' => 'boolean',
            'expires_at' => 'nullable|date',
            'notes' => 'nullable|string',
            'device_model' => 'nullable|string|max:100',
        ]);

        $device->update($validated);
        $device->load(['owner', 'package']);

        return response()->json(['data' => $device, 'message' => 'Updated successfully']);
    }

    public function destroy(int $id): JsonResponse
    {
        $device = MagDevice::findOrFail($id);
        $device->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    public function reboot(int $id): JsonResponse
    {
        $device = MagDevice::findOrFail($id);
        // In production, send reboot command to device
        return response()->json(['message' => 'Reboot command sent to device']);
    }
}
