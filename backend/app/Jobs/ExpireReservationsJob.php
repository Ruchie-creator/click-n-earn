<?php

namespace App\Jobs;

use App\Enums\ReservationStatus;
use App\Models\TaskReservation;
use App\Notifications\EventNotification;
use App\Services\EventNotificationService;
use App\Services\TaskReservationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ExpireReservationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(TaskReservationService $service, EventNotificationService $notifications): void
    {
        TaskReservation::query()
            ->with(['task', 'user'])
            ->whereIn('status', [ReservationStatus::RESERVED->value, ReservationStatus::CHANGES_REQUESTED->value])
            ->whereBetween('expires_at', [now(), now()->addDay()])
            ->orderBy('id')
            ->get()
            ->each(function (TaskReservation $reservation) use ($notifications): void {
                $notifications->notifyOnce($reservation->user, 'reservation.expiring.'.$reservation->id, new EventNotification(
                    'Your reservation is expiring soon',
                    'Complete the task and submit proof before your reservation expires.',
                    'warning',
                    ['reservation_id' => $reservation->id, 'task_id' => $reservation->task_id, 'task' => $reservation->task?->title, 'expires_at' => $reservation->expires_at?->format('M j, Y g:i A')],
                ), $reservation->getAttribute('demo_batch_id'));
            });

        TaskReservation::query()
            ->whereIn('status', [ReservationStatus::RESERVED->value, ReservationStatus::CHANGES_REQUESTED->value])
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->orderBy('id')
            ->pluck('id')
            ->each(fn (int $id): TaskReservation => $service->expire($id));
    }
}
