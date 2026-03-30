<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BlockedIp;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SecurityController extends Controller
{
    public function blockedIps(Request $request): JsonResponse
    {
        $query = BlockedIp::with('blockedByUser');

        if ($request->filled('search')) {
            $query->where('ip_address', 'like', "%{$request->search}%");
        }

        $ips = $query->orderByDesc('created_at')->paginate(min($request->get('per_page', 25), 100));

        return response()->json([
            'data' => $ips->items(),
            'meta' => [
                'current_page' => $ips->currentPage(),
                'last_page' => $ips->lastPage(),
                'per_page' => $ips->perPage(),
                'total' => $ips->total(),
            ],
        ]);
    }

    public function blockIp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ip_address' => 'required|ip',
            'reason' => 'nullable|string|max:500',
            'expires_at' => 'nullable|date|after:now',
            'is_permanent' => 'boolean',
        ]);

        $validated['blocked_by'] = auth('api')->id();

        $blocked = BlockedIp::updateOrCreate(
            ['ip_address' => $validated['ip_address']],
            $validated
        );

        return response()->json(['data' => $blocked, 'message' => 'IP blocked'], 201);
    }

    public function unblockIp(int $id): JsonResponse
    {
        BlockedIp::findOrFail($id)->delete();
        return response()->json(['message' => 'IP unblocked']);
    }

    public function auditLog(Request $request): JsonResponse
    {
        $query = AuditLog::with('user');

        if ($request->filled('search')) {
            $query->where('action', 'like', "%{$request->search}%");
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        $logs = $query->orderByDesc('created_at')->paginate(min($request->get('per_page', 25), 100));

        return response()->json([
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    public function failedLogins(Request $request): JsonResponse
    {
        $logs = AuditLog::where('action', 'failed_login')
            ->with('user')
            ->orderByDesc('created_at')
            ->paginate(min($request->get('per_page', 25), 100));

        return response()->json([
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
