<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionLine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SubscriptionLineController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SubscriptionLine::with(['owner', 'reseller', 'package']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('username', 'like', "%{$search}%")
                  ->orWhereHas('owner', fn($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('status')) {
            match ($request->status) {
                'active' => $query->where('is_active', true)->where('expires_at', '>', now()),
                'expired' => $query->where('expires_at', '<', now()),
                'suspended' => $query->where('is_active', false),
                'trial' => $query->where('is_trial', true),
                default => null,
            };
        }

        if ($request->filled('reseller_id')) {
            $query->where('reseller_id', $request->reseller_id);
        }

        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $query->orderBy($sortBy, $sortDir);

        $perPage = min($request->get('per_page', 15), 100);
        $lines = $query->paginate($perPage);

        return response()->json([
            'data' => $lines->items(),
            'meta' => [
                'current_page' => $lines->currentPage(),
                'last_page' => $lines->lastPage(),
                'per_page' => $lines->perPage(),
                'total' => $lines->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => 'required|string|unique:subscription_lines,username|min:4|max:32',
            'password' => 'required|string|min:4',
            'owner_id' => 'nullable|exists:users,id',
            'reseller_id' => 'nullable|exists:users,id',
            'package_id' => 'nullable|exists:packages,id',
            'bouquet_ids' => 'nullable|array',
            'max_connections' => 'integer|min:1|max:10',
            'is_active' => 'boolean',
            'is_trial' => 'boolean',
            'expires_at' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
            'allowed_ips' => 'nullable|array',
        ]);

        $line = SubscriptionLine::create($validated);
        $line->load(['owner', 'reseller', 'package']);

        return response()->json(['data' => $line, 'message' => 'Subscription line created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $line = SubscriptionLine::with(['owner', 'reseller', 'package', 'liveConnections'])->findOrFail($id);
        return response()->json(['data' => $line]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $line = SubscriptionLine::findOrFail($id);

        $validated = $request->validate([
            'username' => "string|unique:subscription_lines,username,{$id}|min:4|max:32",
            'password' => 'string|min:4',
            'owner_id' => 'nullable|exists:users,id',
            'reseller_id' => 'nullable|exists:users,id',
            'package_id' => 'nullable|exists:packages,id',
            'bouquet_ids' => 'nullable|array',
            'max_connections' => 'integer|min:1|max:10',
            'is_active' => 'boolean',
            'is_trial' => 'boolean',
            'expires_at' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
            'allowed_ips' => 'nullable|array',
        ]);

        $line->update($validated);
        $line->load(['owner', 'reseller', 'package']);

        return response()->json(['data' => $line, 'message' => 'Updated successfully']);
    }

    public function destroy(int $id): JsonResponse
    {
        $line = SubscriptionLine::findOrFail($id);
        $line->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    public function renew(Request $request, int $id): JsonResponse
    {
        $line = SubscriptionLine::findOrFail($id);
        $validated = $request->validate(['days' => 'required|integer|min:1|max:3650']);

        $base = $line->expires_at && $line->expires_at->isFuture() ? $line->expires_at : now();
        $line->update(['expires_at' => $base->addDays($validated['days']), 'is_active' => true]);

        return response()->json(['data' => $line, 'message' => 'Renewed successfully']);
    }

    public function suspend(int $id): JsonResponse
    {
        $line = SubscriptionLine::findOrFail($id);
        $line->update(['is_active' => false]);
        return response()->json(['data' => $line, 'message' => 'Suspended successfully']);
    }

    public function activate(int $id): JsonResponse
    {
        $line = SubscriptionLine::findOrFail($id);
        $line->update(['is_active' => true]);
        return response()->json(['data' => $line, 'message' => 'Activated successfully']);
    }

    public function connections(int $id): JsonResponse
    {
        $line = SubscriptionLine::findOrFail($id);
        $connections = $line->liveConnections()->with('stream')->get();
        return response()->json(['data' => $connections]);
    }
}
