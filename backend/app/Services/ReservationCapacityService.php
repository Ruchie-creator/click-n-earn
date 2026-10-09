<?php

namespace App\Services;

use App\Models\Task;
use App\Models\TaskReservation;
use LogicException;

class ReservationCapacityService
{
    public function release(TaskReservation $reservation, bool $complete = false): Task
    {
        $task = Task::query()->lockForUpdate()->findOrFail($reservation->task_id);
        if ($task->reserved_slots < 1) {
            throw new LogicException('Reservation capacity is inconsistent; refusing to decrement a zero slot count.');
        }

        $task->reserved_slots--;
        if ($complete) {
            $task->completed_slots++;
        }
        $task->save();

        return $task->refresh();
    }
}
