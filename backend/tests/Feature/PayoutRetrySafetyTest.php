<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\LedgerStatus;
use App\Enums\UserRole;
use App\Models\PayoutMethod;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use App\Services\LedgerService;
use App\Services\PayoutService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PayoutRetrySafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_failed_retry_processing_paid_and_reversal_preserve_one_payout_and_two_ledger_entries(): void
    {
        Queue::fake();
        config([
            'payout.driver' => 'fake',
            'payout.fake_outcome' => 'failed',
            'payout.currency' => 'USD',
        ]);

        $member = User::factory()->create(['account_status' => AccountStatus::ACTIVE]);
        User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $task = Task::create([
            'title' => 'Payout retry test',
            'slug' => 'payout-retry-test',
            'description' => 'Controlled payout retry and reversal test.',
            'category' => 'testing',
            'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => '57.00',
            'available_slots' => 1,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
            'created_by' => $member->id,
        ]);
        $task->forceFill(['reserved_slots' => 1])->save();
        $reservation = TaskReservation::create([
            'user_id' => $member->id,
            'task_id' => $task->id,
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => '57.00',
            'status' => 'approved',
            'reserved_at' => now()->subHour(),
            'submitted_at' => now()->subMinutes(40),
            'approved_at' => now()->subMinutes(30),
            'expires_at' => now()->addDay(),
        ]);
        $ledger = app(LedgerService::class);
        $ledger->reserveTaskReward($reservation);
        $ledger->updateReservationStatus($reservation, LedgerStatus::PENDING);
        PayoutMethod::create([
            'user_id' => $member->id,
            'provider' => 'fake',
            'account_holder_name' => $member->name,
            'account_type' => 'bank',
            'country' => 'US',
            'currency' => 'USD',
            'account_last4' => '1234',
            'status' => 'active',
            'is_default' => true,
        ]);

        $service = app(PayoutService::class);
        $payout = $service->createApprovedForReservation($reservation);
        $service->process($payout);
        $this->assertSame('failed', $payout->fresh()->status->value);
        $this->assertSame('payout_failed', $reservation->fresh()->status->value);
        $this->assertDatabaseHas('ledger_entries', ['task_reservation_id' => $reservation->id, 'status' => LedgerStatus::FAILED->value]);

        $service->retryFailed($payout);
        $service->retryFailed($payout);
        $this->assertSame('approved', $payout->fresh()->status->value);
        $this->assertSame('approved', $reservation->fresh()->status->value);
        $this->assertDatabaseHas('ledger_entries', ['task_reservation_id' => $reservation->id, 'status' => LedgerStatus::PENDING->value]);

        config(['payout.fake_outcome' => 'processing']);
        $service->process($payout);
        $this->assertSame('processing', $payout->fresh()->status->value);
        $this->assertSame('processing', $reservation->fresh()->status->value);
        $this->assertDatabaseHas('ledger_entries', ['task_reservation_id' => $reservation->id, 'status' => LedgerStatus::PROCESSING->value]);

        config(['payout.fake_outcome' => 'paid']);
        $service->sync($payout);
        $service->sync($payout);
        $this->assertSame('paid', $payout->fresh()->status->value);
        $this->assertSame('paid', $reservation->fresh()->status->value);
        $this->assertNotNull($reservation->fresh()->completed_at);

        $service->markProviderStatus($payout, 'failed', $payout->fresh()->provider_reference);
        $service->markProviderStatus($payout, 'failed', $payout->fresh()->provider_reference);

        $this->assertSame('reversed', $payout->fresh()->status->value);
        $this->assertSame('reversed', $reservation->fresh()->status->value);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'reserved_slots' => 0, 'completed_slots' => 1]);
        $this->assertSame('reservation-'.$reservation->id, $payout->fresh()->idempotency_key);
        $this->assertDatabaseCount('payouts', 1);
        $this->assertDatabaseCount('ledger_entries', 2);
        $this->assertDatabaseMissing('ledger_entries', ['task_reservation_id' => $reservation->id, 'status' => LedgerStatus::FAILED->value]);
        $this->assertDatabaseHas('ledger_entries', ['task_reservation_id' => $reservation->id, 'status' => LedgerStatus::REVERSED->value]);
        $this->assertDatabaseCount('notification_outbox', 5);
    }
}
