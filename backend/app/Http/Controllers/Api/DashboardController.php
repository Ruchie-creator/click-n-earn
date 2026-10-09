<?php

namespace App\Http\Controllers\Api;

use App\Enums\LedgerStatus;
use App\Enums\ReservationStatus;
use App\Models\TaskReservation;
use App\Services\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends ApiController
{
    public function __invoke(Request $request, LedgerService $ledger): JsonResponse
    {
        $user = $request->user();
        $totals = $ledger->totals($user);
        $reservations = $user->reservations()->with('task')->latest()->limit(6)->get();

        return $this->ok([
            'stats' => [
                ...$totals,
                'tasks_in_progress' => $user->reservations()->whereIn('status', array_map(static fn (ReservationStatus $status): string => $status->value, [
                    ReservationStatus::RESERVED,
                    ReservationStatus::PROOF_SUBMITTED,
                    ReservationStatus::UNDER_REVIEW,
                    ReservationStatus::CHANGES_REQUESTED,
                    ReservationStatus::APPROVED,
                    ReservationStatus::PROCESSING,
                ]))->count(),
                'completed_tasks' => $user->reservations()->where('status', ReservationStatus::PAID->value)->count(),
                'successful_referrals' => $user->referralsSent()->whereNotNull('qualified_at')->count(),
            ],
            'recent_reservations' => $reservations->map(fn (TaskReservation $reservation): array => $this->reservationPayload($reservation))->values(),
            'notifications_unread' => $user->unreadNotifications()->count(),
        ]);
    }
}
