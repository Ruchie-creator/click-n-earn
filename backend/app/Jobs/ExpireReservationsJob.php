<?php

namespace App\Jobs;

use App\Enums\ReservationStatus;
use App\Models\TaskReservation;
use App\Services\TaskReservationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ExpireReservationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(TaskReservationService $service): void
    {
        TaskReservation::query()
            ->whereIn('status', [ReservationStatus::RESERVED->value, ReservationStatus::CHANGES_REQUESTED->value])
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->orderBy('id')
            ->pluck('id')
            ->each(fn (int $id): TaskReservation => $service->expire($id));
    }
}
