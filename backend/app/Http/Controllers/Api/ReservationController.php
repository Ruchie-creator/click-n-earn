<?php

namespace App\Http\Controllers\Api;

use App\Enums\ReservationStatus;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Notifications\EventNotification;
use App\Services\EventNotificationService;
use App\Services\LedgerService;
use App\Services\ReservationCapacityService;
use App\Services\StatusTransitionService;
use App\Services\TaskReservationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReservationController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $reservations = $request->user()->reservations()->with('task')->latest()->paginate(20);

        return $this->ok([
            'items' => $reservations->getCollection()->map(fn (TaskReservation $reservation): array => $this->reservationPayload($reservation))->values(),
            'meta' => [
                'current_page' => $reservations->currentPage(),
                'last_page' => $reservations->lastPage(),
                'total' => $reservations->total(),
            ],
        ]);
    }

    public function show(Request $request, TaskReservation $reservation): JsonResponse
    {
        abort_unless($reservation->user_id === $request->user()->id, 404);

        return $this->ok($this->reservationPayload($reservation));
    }

    public function reserve(Request $request, Task $task, TaskReservationService $service): JsonResponse
    {
        $reservation = $service->reserve($request->user(), $task);

        return $this->ok($this->reservationPayload($reservation), 201);
    }

    public function cancel(
        Request $request,
        TaskReservation $reservation,
        StatusTransitionService $transitions,
        ReservationCapacityService $capacity,
        LedgerService $ledger,
        EventNotificationService $notifications,
    ): JsonResponse
    {
        abort_unless($reservation->user_id === $request->user()->id, 404);
        DB::transaction(function () use ($reservation, $request, $transitions, $capacity, $ledger, $notifications): void {
            $locked = TaskReservation::query()->lockForUpdate()->with('user')->findOrFail($reservation->id);
            if ($locked->status === ReservationStatus::CANCELLED) {
                return;
            }
            if (! in_array($locked->status, [ReservationStatus::RESERVED, ReservationStatus::CHANGES_REQUESTED], true)) {
                throw ValidationException::withMessages(['status' => 'This reservation cannot be cancelled at its current status.']);
            }

            $transitions->transition($locked, ReservationStatus::CANCELLED->value, $request->user()->id, 'Cancelled by member.');
            $ledger->updateReservationStatus($locked, \App\Enums\LedgerStatus::CANCELLED);
            $capacity->release($locked);
            $notifications->notifyOnce($locked->user, 'reservation.cancelled.'.$locked->id, new EventNotification(
                'Reservation cancelled',
                'Your reserved reward was released.',
                'info',
                ['reservation_id' => $locked->id],
            ), $locked->getAttribute('demo_batch_id'));
        });

        return $this->message('Reservation cancelled.');
    }
}
