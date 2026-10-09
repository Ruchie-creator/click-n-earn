<?php

namespace Tests\Unit;

use App\Models\TaskReservation;
use App\Services\StatusTransitionService;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class StatusTransitionServiceTest extends TestCase
{
    public function test_arbitrary_reservation_status_updates_are_rejected(): void
    {
        $reservation = new TaskReservation();
        $reservation->setRawAttributes(['status' => 'reserved']);

        $this->expectException(ValidationException::class);
        (new StatusTransitionService())->transition($reservation, 'paid');
    }
}
