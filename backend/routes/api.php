<?php

use App\Http\Controllers\Api\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\Admin\DemoDataController;
use App\Http\Controllers\Api\Admin\PayoutController as AdminPayoutController;
use App\Http\Controllers\Api\Admin\ReferralController as AdminReferralController;
use App\Http\Controllers\Api\Admin\SubmissionController as AdminSubmissionController;
use App\Http\Controllers\Api\Admin\SettingController as AdminSettingController;
use App\Http\Controllers\Api\Admin\NotificationController as AdminNotificationController;
use App\Http\Controllers\Api\Admin\TaskController as AdminTaskController;
use App\Http\Controllers\Api\Admin\TransactionController as AdminTransactionController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EarningsController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PayoutController;
use App\Http\Controllers\Api\PayoutMethodController;
use App\Http\Controllers\Api\ProofSubmissionController;
use App\Http\Controllers\Api\ReferralController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->middleware('throttle:auth')->group(function (): void {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);
});

Route::post('webhooks/airwallex', [WebhookController::class, 'airwallex'])->middleware('throttle:api');

Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->group(function (): void {
    Route::get('me', [AuthController::class, 'me']);
    Route::patch('profile', [AuthController::class, 'updateProfile']);
    Route::put('me', [AuthController::class, 'updateProfile']);
    Route::post('password', [AuthController::class, 'updatePassword']);
    Route::post('email/verify', [AuthController::class, 'verifyEmail']);
    Route::post('logout', [AuthController::class, 'logout']);

    Route::get('dashboard', DashboardController::class);
    Route::get('tasks', [TaskController::class, 'index']);
    Route::get('tasks/{task}', [TaskController::class, 'show']);
    Route::post('tasks/{task}/reserve', [ReservationController::class, 'reserve']);
    Route::get('reservations', [ReservationController::class, 'index']);
    Route::get('my-tasks', [ReservationController::class, 'index']);
    Route::get('reservations/{reservation}', [ReservationController::class, 'show']);
    Route::get('my-tasks/{reservation}', [ReservationController::class, 'show']);
    Route::post('reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);
    Route::post('reservations/{reservation}/proof', [ProofSubmissionController::class, 'store']);
    Route::post('my-tasks/{reservation}/proof', [ProofSubmissionController::class, 'store']);
    Route::get('proof/{proof}/download', [ProofSubmissionController::class, 'download']);
    Route::get('earnings', [EarningsController::class, 'index']);
    Route::get('referrals', [ReferralController::class, 'index']);
    Route::get('payout-methods', [PayoutMethodController::class, 'index']);
    Route::post('payout-methods', [PayoutMethodController::class, 'store']);
    Route::put('payout-methods/{payoutMethod}', [PayoutMethodController::class, 'update']);
    Route::delete('payout-methods/{payoutMethod}', [PayoutMethodController::class, 'destroy']);
    Route::get('payouts', [PayoutController::class, 'index']);
    Route::get('payouts/{payout}', [PayoutController::class, 'show']);
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
    Route::post('notifications/{notification}/read', [NotificationController::class, 'read']);

    Route::prefix('admin')->middleware('role:admin,super_admin')->group(function (): void {
        Route::get('dashboard', AdminDashboardController::class);
        Route::get('tasks', [AdminTaskController::class, 'index']);
        Route::post('tasks', [AdminTaskController::class, 'store']);
        Route::patch('tasks/{task}', [AdminTaskController::class, 'update']);
        Route::post('tasks/{task}/status', [AdminTaskController::class, 'changeStatus']);
        Route::post('tasks/{task}/publish', [AdminTaskController::class, 'publish']);
        Route::post('tasks/{task}/pause', [AdminTaskController::class, 'pause']);
        Route::get('submissions', [AdminSubmissionController::class, 'index']);
        Route::get('submissions/{submission}', [AdminSubmissionController::class, 'show']);
        Route::post('submissions/{submission}/review', [AdminSubmissionController::class, 'review']);
        Route::post('submissions/{submission}/approve', [AdminSubmissionController::class, 'approve']);
        Route::post('submissions/{submission}/request-changes', [AdminSubmissionController::class, 'requestChanges']);
        Route::post('submissions/{submission}/reject', [AdminSubmissionController::class, 'reject']);
        Route::get('submissions/{submission}/download', [AdminSubmissionController::class, 'download']);
        Route::get('payouts', [AdminPayoutController::class, 'index']);
        Route::post('payouts/{payout}/process', [AdminPayoutController::class, 'process']);
        Route::post('payouts/{payout}/retry', [AdminPayoutController::class, 'retry']);
        Route::post('payouts/{payout}/sync', [AdminPayoutController::class, 'sync']);
        Route::post('payouts/{payout}/manual-paid', [AdminPayoutController::class, 'manualPaid']);
        Route::post('payouts/{payout}/mark-paid', [AdminPayoutController::class, 'markPaid']);
        Route::get('users', [AdminUserController::class, 'index']);
        Route::get('users/{user}', [AdminUserController::class, 'show']);
        Route::patch('users/{user}', [AdminUserController::class, 'update']);
        Route::post('users/{user}/suspend', [AdminUserController::class, 'suspend']);
        Route::post('users/{user}/activate', [AdminUserController::class, 'activate']);
        Route::get('referrals', [AdminReferralController::class, 'index']);
        Route::get('transactions', [AdminTransactionController::class, 'index']);
        Route::get('audit-logs', [AdminTransactionController::class, 'audit']);
        Route::get('notifications', [AdminNotificationController::class, 'index']);
        Route::get('settings', [AdminSettingController::class, 'index']);
        Route::patch('settings/{key}', [AdminSettingController::class, 'update']);
        Route::get('demo-data', [DemoDataController::class, 'status']);
        Route::post('demo-data/seed', [DemoDataController::class, 'seed']);
        Route::post('demo-data/refresh', [DemoDataController::class, 'refresh']);
        Route::post('demo-data/clear', [DemoDataController::class, 'clear']);
    });
});
