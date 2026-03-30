<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LiveConnection;
use App\Models\SubscriptionLine;
use App\Models\User;
use App\Models\Stream;
use App\Models\Server;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $totalLines = SubscriptionLine::count();
        $activeLines = SubscriptionLine::where('is_active', true)->where('expires_at', '>', now())->count();
        $expiredLines = SubscriptionLine::where('expires_at', '<', now())->count();
        $expiringToday = SubscriptionLine::whereBetween('expires_at', [now(), now()->endOfDay()])->count();
        $liveConnections = LiveConnection::count();
        $totalUsers = User::where('role', 'user')->count();
        $totalResellers = User::where('role', 'reseller')->count();
        $activeStreams = Stream::where('is_active', true)->count();
        $totalStreams = Stream::count();
        $serversOnline = Server::where('is_active', true)->count();

        $newLinesToday = SubscriptionLine::whereDate('created_at', today())->count();
        $newLinesWeek = SubscriptionLine::whereBetween('created_at', [now()->startOfWeek(), now()])->count();

        return response()->json([
            'data' => [
                'lines' => [
                    'total' => $totalLines,
                    'active' => $activeLines,
                    'expired' => $expiredLines,
                    'expiring_today' => $expiringToday,
                    'new_today' => $newLinesToday,
                    'new_this_week' => $newLinesWeek,
                ],
                'connections' => [
                    'live' => $liveConnections,
                ],
                'users' => [
                    'total' => $totalUsers,
                    'resellers' => $totalResellers,
                ],
                'streams' => [
                    'total' => $totalStreams,
                    'active' => $activeStreams,
                ],
                'servers' => [
                    'online' => $serversOnline,
                ],
            ],
        ]);
    }

    public function revenue(Request $request): JsonResponse
    {
        $period = $request->get('period', '30');
        $days = min((int) $period, 365);

        $data = collect(range(0, $days - 1))->map(function ($daysAgo) {
            $date = now()->subDays($daysAgo)->format('Y-m-d');
            $count = SubscriptionLine::whereDate('created_at', $date)->count();
            return [
                'date' => $date,
                'new_lines' => $count,
                'revenue' => $count * 10,
            ];
        })->reverse()->values();

        return response()->json(['data' => $data]);
    }

    public function activity(): JsonResponse
    {
        $activities = DB::table('audit_logs')
            ->join('users', 'audit_logs.user_id', '=', 'users.id')
            ->select('audit_logs.*', 'users.name as user_name', 'users.email as user_email')
            ->orderByDesc('audit_logs.created_at')
            ->limit(20)
            ->get();

        return response()->json(['data' => $activities]);
    }
}
