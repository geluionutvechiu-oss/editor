<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\SubscriptionLine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResellerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::where('role', 'reseller');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        $query->withCount('clients')->withCount('subscriptionLines');
        $query->orderBy($request->get('sort_by', 'created_at'), $request->get('sort_dir', 'desc'));
        $resellers = $query->paginate(min($request->get('per_page', 15), 100));

        return response()->json([
            'data' => $resellers->items(),
            'meta' => [
                'current_page' => $resellers->currentPage(),
                'last_page' => $resellers->lastPage(),
                'per_page' => $resellers->perPage(),
                'total' => $resellers->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'is_active' => 'boolean',
            'phone' => 'nullable|string|max:20',
            'country' => 'nullable|string|max:5',
            'credits' => 'nullable|numeric|min:0',
        ]);

        $validated['role'] = 'reseller';
        $validated['password'] = bcrypt($validated['password']);
        $reseller = User::create($validated);

        return response()->json(['data' => $reseller, 'message' => 'Reseller created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $reseller = User::where('role', 'reseller')
            ->withCount('clients')
            ->withCount('subscriptionLines')
            ->findOrFail($id);
        return response()->json(['data' => $reseller]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $reseller = User::where('role', 'reseller')->findOrFail($id);

        $validated = $request->validate([
            'name' => 'string|max:255',
            'email' => "email|unique:users,email,{$id}",
            'password' => 'nullable|string|min:8',
            'is_active' => 'boolean',
            'phone' => 'nullable|string|max:20',
            'country' => 'nullable|string|max:5',
            'credits' => 'nullable|numeric|min:0',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = bcrypt($validated['password']);
        } else {
            unset($validated['password']);
        }

        $reseller->update($validated);
        return response()->json(['data' => $reseller, 'message' => 'Updated successfully']);
    }

    public function destroy(int $id): JsonResponse
    {
        $reseller = User::where('role', 'reseller')->findOrFail($id);
        $reseller->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    public function addCredits(Request $request, int $id): JsonResponse
    {
        $reseller = User::where('role', 'reseller')->findOrFail($id);
        $validated = $request->validate(['amount' => 'required|numeric|min:0.01']);
        $reseller->increment('credits', $validated['amount']);
        return response()->json(['data' => $reseller->fresh(), 'message' => 'Credits added']);
    }

    public function lines(int $id): JsonResponse
    {
        $reseller = User::where('role', 'reseller')->findOrFail($id);
        $lines = SubscriptionLine::where('reseller_id', $id)
            ->with(['owner', 'package'])
            ->orderByDesc('created_at')
            ->paginate(15);

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
}
