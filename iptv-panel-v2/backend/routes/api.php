<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ResellerController;
use App\Http\Controllers\Api\SubscriptionLineController;
use App\Http\Controllers\Api\MagDeviceController;
use App\Http\Controllers\Api\Enigma2Controller;
use App\Http\Controllers\Api\StreamController;
use App\Http\Controllers\Api\VodMovieController;
use App\Http\Controllers\Api\VodSeriesController;
use App\Http\Controllers\Api\BouquetController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\ServerController;
use App\Http\Controllers\Api\EpgController;
use App\Http\Controllers\Api\SecurityController;
use App\Http\Controllers\Api\StatisticsController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\LiveConnectionController;

// Public routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('jwt.auth');
    Route::get('/me', [AuthController::class, 'me'])->middleware('jwt.auth');
    Route::post('/refresh', [AuthController::class, 'refresh'])->middleware('jwt.auth');
});

// Protected routes
Route::middleware('jwt.auth')->group(function () {

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/revenue', [DashboardController::class, 'revenue']);
    Route::get('/dashboard/activity', [DashboardController::class, 'activity']);

    // Live Connections
    Route::get('/live-connections', [LiveConnectionController::class, 'index']);
    Route::delete('/live-connections/{id}', [LiveConnectionController::class, 'destroy']);
    Route::post('/live-connections/kick-all', [LiveConnectionController::class, 'kickAll']);

    // Subscription Lines
    Route::apiResource('subscriptions/lines', SubscriptionLineController::class);
    Route::post('/subscriptions/lines/{id}/renew', [SubscriptionLineController::class, 'renew']);
    Route::post('/subscriptions/lines/{id}/suspend', [SubscriptionLineController::class, 'suspend']);
    Route::post('/subscriptions/lines/{id}/activate', [SubscriptionLineController::class, 'activate']);
    Route::get('/subscriptions/lines/{id}/connections', [SubscriptionLineController::class, 'connections']);

    // MAG Devices
    Route::apiResource('subscriptions/mag-devices', MagDeviceController::class);
    Route::post('/subscriptions/mag-devices/{id}/reboot', [MagDeviceController::class, 'reboot']);

    // Enigma2
    Route::apiResource('subscriptions/enigma2', Enigma2Controller::class);

    // Streams
    Route::apiResource('streams', StreamController::class);
    Route::post('/streams/{id}/restart', [StreamController::class, 'restart']);
    Route::get('/streams/{id}/stats', [StreamController::class, 'stats']);
    Route::post('/streams/bulk-action', [StreamController::class, 'bulkAction']);

    // VOD Movies
    Route::apiResource('vods/movies', VodMovieController::class);
    Route::post('/vods/movies/bulk-action', [VodMovieController::class, 'bulkAction']);

    // VOD Series
    Route::apiResource('vods/series', VodSeriesController::class);
    Route::get('/vods/series/{id}/episodes', [VodSeriesController::class, 'episodes']);
    Route::post('/vods/series/{id}/episodes', [VodSeriesController::class, 'addEpisode']);

    // Bouquets
    Route::apiResource('bouquets', BouquetController::class);
    Route::post('/bouquets/{id}/streams', [BouquetController::class, 'addStreams']);
    Route::delete('/bouquets/{id}/streams', [BouquetController::class, 'removeStreams']);

    // Packages
    Route::apiResource('packages', PackageController::class);

    // Users (admin only)
    Route::apiResource('users', UserController::class);
    Route::post('/users/{id}/toggle-status', [UserController::class, 'toggleStatus']);

    // Resellers
    Route::apiResource('resellers', ResellerController::class);
    Route::post('/resellers/{id}/add-credits', [ResellerController::class, 'addCredits']);
    Route::get('/resellers/{id}/lines', [ResellerController::class, 'lines']);

    // Servers
    Route::apiResource('servers', ServerController::class);
    Route::get('/servers/{id}/stats', [ServerController::class, 'stats']);
    Route::post('/servers/{id}/test', [ServerController::class, 'test']);

    // EPG
    Route::get('/epg', [EpgController::class, 'index']);
    Route::post('/epg', [EpgController::class, 'store']);
    Route::put('/epg/{id}', [EpgController::class, 'update']);
    Route::delete('/epg/{id}', [EpgController::class, 'destroy']);
    Route::post('/epg/{id}/sync', [EpgController::class, 'sync']);

    // Security
    Route::get('/security/blocked-ips', [SecurityController::class, 'blockedIps']);
    Route::post('/security/block-ip', [SecurityController::class, 'blockIp']);
    Route::delete('/security/blocked-ips/{id}', [SecurityController::class, 'unblockIp']);
    Route::get('/security/audit-log', [SecurityController::class, 'auditLog']);
    Route::get('/security/failed-logins', [SecurityController::class, 'failedLogins']);

    // Statistics
    Route::get('/statistics/overview', [StatisticsController::class, 'overview']);
    Route::get('/statistics/streams', [StatisticsController::class, 'streams']);
    Route::get('/statistics/users', [StatisticsController::class, 'users']);
    Route::get('/statistics/bandwidth', [StatisticsController::class, 'bandwidth']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications', [NotificationController::class, 'store']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // Tickets
    Route::apiResource('tickets', TicketController::class);
    Route::post('/tickets/{id}/reply', [TicketController::class, 'reply']);
    Route::post('/tickets/{id}/close', [TicketController::class, 'close']);
    Route::post('/tickets/{id}/open', [TicketController::class, 'reopen']);
});
