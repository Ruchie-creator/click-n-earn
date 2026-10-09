<?php

namespace App\Services;

use App\Enums\ReservationStatus;
use App\Enums\LedgerStatus;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use App\Notifications\EventNotification;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TaskReservationService
{
    public function __construct(
        private readonly LedgerService $ledger,
        private readonly StatusTransitionService $transitions,
        private readonly AuditLogService $audit,
        private readonly ReservationCapacityService $capacity,
        private readonly EventNotificationService $notifications,
    ) {
    }

    public function reserve(User $user, Task|int $task, ?string $demoKey = null): TaskReservation
    {
        return DB::transaction(function () use ($user, $task, $demoKey): TaskReservation {
            $taskModel = Task::query()->lockForUpdate()->findOrFail($task instanceof Task ? $task->getKey() : $task);

            $userBatchId = $user->getAttribute('demo_batch_id');
            $taskBatchId = $taskModel->getAttribute('demo_batch_id');
            if ($userBatchId && $taskBatchId && $userBatchId !== $taskBatchId) {
                throw ValidationException::withMessages(['task' => 'This task is not available to the selected preview account.']);
            }
            $demoBatchId = $userBatchId ?: $taskBatchId;

            if ($user->account_status?->value !== 'active') {
                throw ValidationException::withMessages(['account' => 'Your account is not active.']);
            }
            if (! $taskModel->isAcceptable()) {
                throw ValidationException::withMessages(['task' => 'This task is no longer available.']);
            }
            if (TaskReservation::query()->where('user_id', $user->id)->where('task_id', $taskModel->id)->whereIn(
                'status',
                array_map(static fn (ReservationStatus $status): string => $status->value, array_filter(
                    ReservationStatus::cases(),
                    static fn (ReservationStatus $status): bool => $status->isActive(),
                )),
            )->exists()) {
                throw ValidationException::withMessages(['task' => 'You already have an active reservation for this task.']);
            }

            $reimbursement = (string) $taskModel->reimbursement_amount;
            $incentive = (string) $taskModel->incentive_amount;
            $reservation = TaskReservation::create([
                'user_id' => $user->id,
                'task_id' => $taskModel->id,
                'reimbursement_amount' => $reimbursement,
                'incentive_amount' => $incentive,
                'expected_payout' => Money::add($reimbursement, $incentive),
                'status' => ReservationStatus::RESERVED,
                'reserved_at' => now(),
                'expires_at' => $taskModel->expires_at ?: now()->addDays(3),
            ]);
            if ($demoBatchId) {
                $reservation->forceFill([
                    'demo_batch_id' => $demoBatchId,
                    'demo_key' => $demoKey ?: 'reservation-'.$reservation->id,
                ])->save();
            }

            $taskModel->increment('reserved_slots');
            $taskModel->refresh();

            $this->ledger->reserveTaskReward($reservation);
            $this->transitions->recordInitial($reservation, $user->id, ['task_id' => $taskModel->id]);
            $this->audit->record('reservation.created', $reservation, actorId: $user->id, after: $reservation->toArray());

            $this->notifications->notifyOnce($user, 'reservation.created.'.$reservation->id, new EventNotification(
                'Reserved Reward confirmed',
                sprintf('Your %s reward is reserved. Complete the purchase and submit proof before the deadline.', $taskModel->title),
                'warning',
                ['reservation_id' => $reservation->id, 'expected_payout' => $reservation->expected_payout],
            ), $demoBatchId);

            return $reservation->load('task');
        });
    }

    public function expire(int $reservationId): TaskReservation
    {
        return DB::transaction(function () use ($reservationId): TaskReservation {
            $reservation = TaskReservation::query()->lockForUpdate()->with(['task', 'user'])->findOrFail($reservationId);
            if (! in_array($reservation->status, [ReservationStatus::RESERVED, ReservationStatus::CHANGES_REQUESTED], true)) {
                return $reservation;
            }

            $this->transitions->transition($reservation, ReservationStatus::EXPIRED->value, reason: 'Reservation expired.');
            $this->ledger->updateReservationStatus($reservation, LedgerStatus::CANCELLED);
            $this->capacity->release($reservation);
            $this->notifications->notifyOnce($reservation->user, 'reservation.expired.'.$reservation->id, new EventNotification(
                'Reserved task expired',
                'Your reservation expired before proof was submitted. Any reserved reward has been released.',
                'warning',
                ['reservation_id' => $reservation->id],
            ), $reservation->getAttribute('demo_batch_id'));

            return $reservation->fresh('task');
        });
    }
}
