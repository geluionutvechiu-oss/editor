<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Notification::where('user_id', auth('api')->id());

        if ($request->filled('is_read')) {
            $query->where('is_read', filter_var($request->is_read, FILTER_VALIDATE_BOOLEAN));
        }

        $notifications = $query->orderByDesc('created_at')->paginate(min($request->get('per_page', 20), 100));

        return response()->json([
            'data' => $notifications->items(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
                'unread_count' => Notification::where('user_id', auth('api')->id())->where('is_read', false)->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'type' => 'in:info,warning,success,error',
            'link' => 'nullable|string|max:500',
        ]);

        $validated['user_id'] = $validated['user_id'] ?? auth('api')->id();
        $notification = Notification::create($validated);

        return response()->json(['data' => $notification, 'message' => 'Notification created'], 201);
    }

    public function markRead(int $id): JsonResponse
    {
        $notification = Notification::where('user_id', auth('api')->id())->findOrFail($id);
        $notification->update(['is_read' => true, 'read_at' => now()]);
        return response()->json(['data' => $notification, 'message' => 'Marked as read']);
    }

    public function markAllRead(): JsonResponse
    {
        Notification::where('user_id', auth('api')->id())
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);
        return response()->json(['message' => 'All notifications marked as read']);
    }

    public function destroy(int $id): JsonResponse
    {
        Notification::where('user_id', auth('api')->id())->findOrFail($id)->delete();
        return response()->json(['message' => 'Notification deleted']);
    }
}
