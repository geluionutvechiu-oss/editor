<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        $query->orderBy($request->get('sort_by', 'created_at'), $request->get('sort_dir', 'desc'));
        $users = $query->paginate(min($request->get('per_page', 15), 100));

        return response()->json([
            'data' => $users->items(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|in:admin,reseller,user',
            'is_active' => 'boolean',
            'reseller_id' => 'nullable|exists:users,id',
            'phone' => 'nullable|string|max:20',
            'country' => 'nullable|string|max:5',
            'credits' => 'nullable|numeric|min:0',
        ]);

        $validated['password'] = bcrypt($validated['password']);
        $user = User::create($validated);

        return response()->json(['data' => $user, 'message' => 'User created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $user = User::with(['reseller', 'subscriptionLines'])->findOrFail($id);
        return response()->json(['data' => $user]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'string|max:255',
            'email' => "email|unique:users,email,{$id}",
            'password' => 'nullable|string|min:8',
            'role' => 'in:admin,reseller,user',
            'is_active' => 'boolean',
            'reseller_id' => 'nullable|exists:users,id',
            'phone' => 'nullable|string|max:20',
            'country' => 'nullable|string|max:5',
            'credits' => 'nullable|numeric|min:0',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = bcrypt($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);
        return response()->json(['data' => $user, 'message' => 'Updated successfully']);
    }

    public function destroy(int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $user->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    public function toggleStatus(int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $user->update(['is_active' => !$user->is_active]);
        return response()->json(['data' => $user, 'message' => 'Status updated']);
    }
}
