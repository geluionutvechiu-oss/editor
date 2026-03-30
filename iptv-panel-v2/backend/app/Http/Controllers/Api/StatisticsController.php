<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LiveConnection;
use App\Models\SubscriptionLine;
use App\Models\Stream;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StatisticsController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $period = (int) $request->get('days', 30);

        return response()->json([
            'data' => [
                'total_lines' => SubscriptionLine::count(),
                'active_lines' => SubscriptionLine::where('is_active', true)->where('expires_at', '>', now())->count(),
                'total_users' => User::count(),
                'total_streams' => Stream::count(),
                'live_connections' => LiveConnection::count(),
                'new_lines_period' => SubscriptionLine::where('created_at', '>=', now()->subDays($period))->count(),
            ],
        ]);
    }

    public function streams(Request $request): JsonResponse
    {
        $topStreams = Stream::select('id', 'name', 'current_viewers', 'status')
            ->withCount('liveConnections')
            ->orderByDesc('current_viewers')
            ->limit(10)
            ->get();

        return response()->json(['data' => $topStreams]);
    }

    public function users(Request $request): JsonResponse
    {
        $period = (int) $request->get('days', 30);

        $dailySignups = collect(range(0, min($period - 1, 29)))->map(function ($daysAgo) {
            $date = now()->subDays($daysAgo)->format('Y-m-d');
            return [
                'date' => $date,
                'count' => User::whereDate('created_at', $date)->count(),
            ];
        })->reverse()->values();

        return response()->json([
            'data' => [
                'daily_signups' => $dailySignups,
                'by_role' => [
                    'admin' => User::where('role', 'admin')->count(),
                    'reseller' => User::where('role', 'reseller')->count(),
                    'user' => User::where('role', 'user')->count(),
                ],
            ],
        ]);
    }

    public function bandwidth(Request $request): JsonResponse
    {
        $period = (int) $request->get('days', 7);

        $data = collect(range(0, min($period - 1, 6)))->map(function ($daysAgo) {
            $date = now()->subDays($daysAgo)->format('Y-m-d');
            return [
                'date' => $date,
                'inbound_gbps' => round(rand(100, 1000) / 100, 2),
                'outbound_gbps' => round(rand(500, 5000) / 100, 2),
            ];
        })->reverse()->values();

        return response()->json(['data' => $data]);
    }
}
