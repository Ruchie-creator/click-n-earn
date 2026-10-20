<?php

namespace Tests\Feature;

use App\Enums\LedgerStatus;
use App\Jobs\ExpireReservationsJob;
use App\Models\PayoutMethod;
use App\Models\Task;
use App\Models\User;
use App\Services\EventNotificationService;
use App\Services\StatusTransitionService;
use App\Services\TaskReservationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationFinancialSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_competing_members_cannot_oversubscribe_the_last_slot_or_choose_financial_values(): void
    {
        $owner = User::factory()->create();
        $firstMember = User::factory()->create();
        $secondMember = User::factory()->create();
        $this->approveBankAccount($firstMember);
        $this->approveBankAccount($secondMember);
        $task = $this->makeTask($owner, 1);

        $this->actingAs($firstMember, 'sanctum')
            ->postJson('/api/tasks/'.$task->id.'/reserve', [
                'reimbursement_amount' => '0.01',
                'incentive_amount' => '999.99',
                'expected_payout' => '1000.00',
            ])
            ->assertCreated()
            ->assertJsonPath('data.reimbursement_amount', 48.75)
            ->assertJsonPath('data.incentive_amount', 11.25)
            ->assertJsonPath('data.expected_payout', 60);

        $this->actingAs($secondMember, 'sanctum')
            ->postJson('/api/tasks/'.$task->id.'/reserve')
            ->assertUnprocessable();

        $this->assertDatabaseCount('task_reservations', 1);
        $this->assertDatabaseCount('ledger_entries', 2);
        $this->assertDatabaseHas('tasks', [
            'id' => $task->id,
            'reserved_slots' => 1,
            'completed_slots' => 0,
        ]);
        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $firstMember->id,
            'amount' => '48.75',
            'status' => LedgerStatus::RESERVED->value,
        ]);
        $this->assertDatabaseHas('ledger_entries', [
            'user_id' => $firstMember->id,
            'amount' => '11.25',
            'status' => LedgerStatus::RESERVED->value,
        ]);
    }

    public function test_a_member_cannot_create_two_active_reservations_for_the_same_task(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $this->approveBankAccount($member);
        $task = $this->makeTask($owner, 2);

        $this->actingAs($member, 'sanctum')->postJson('/api/tasks/'.$task->id.'/reserve')->assertCreated();
        $this->actingAs($member, 'sanctum')->postJson('/api/tasks/'.$task->id.'/reserve')->assertUnprocessable();

        $this->assertDatabaseCount('task_reservations', 1);
        $this->assertDatabaseCount('ledger_entries', 2);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'reserved_slots' => 1]);
    }

    public function test_member_cannot_view_or_cancel_another_members_reservation(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $otherMember = User::factory()->create();
        $this->approveBankAccount($member);
        $this->approveBankAccount($otherMember);
        $task = $this->makeTask($owner, 1);
        $reservation = app(TaskReservationService::class)->reserve($member, $task);

        $this->actingAs($otherMember, 'sanctum')
            ->getJson('/api/reservations/'.$reservation->id)
            ->assertNotFound();
        $this->actingAs($otherMember, 'sanctum')
            ->postJson('/api/reservations/'.$reservation->id.'/cancel')
            ->assertNotFound();

        $this->assertSame('reserved', $reservation->fresh()->status->value);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'reserved_slots' => 1]);
        $this->assertDatabaseCount('ledger_entries', 2);
    }

    public function test_expiration_job_is_idempotent_and_releases_reserved_finances_once(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $this->approveBankAccount($member);
        $task = $this->makeTask($owner, 1);
        $reservation = app(TaskReservationService::class)->reserve($member, $task);
        $reservation->forceFill(['expires_at' => now()->subMinute()])->save();
        $job = new ExpireReservationsJob;

        $job->handle(app(TaskReservationService::class), app(EventNotificationService::class));
        $job->handle(app(TaskReservationService::class), app(EventNotificationService::class));

        $this->assertSame('expired', $reservation->fresh()->status->value);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'reserved_slots' => 0]);
        $this->assertDatabaseCount('status_histories', 2);
        $this->assertDatabaseCount('ledger_entries', 2);
        $this->assertDatabaseMissing('ledger_entries', ['task_reservation_id' => $reservation->id, 'status' => LedgerStatus::RESERVED->value]);
        $this->assertDatabaseCount('notification_outbox', 2);
        $this->assertDatabaseHas('notification_outbox', [
            'user_id' => $member->id,
            'event_key' => 'reservation.expired.'.$reservation->id,
        ]);
    }

    public function test_an_expired_unsubmitted_reservation_can_be_reserved_again(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $this->approveBankAccount($member);
        $task = $this->makeTask($owner, 2);
        $first = app(TaskReservationService::class)->reserve($member, $task);
        $first->forceFill(['expires_at' => now()->subMinute()])->save();

        (new ExpireReservationsJob)->handle(app(TaskReservationService::class), app(EventNotificationService::class));
        $second = app(TaskReservationService::class)->reserve($member->fresh(), $task->fresh());

        $this->assertSame('expired', $first->fresh()->status->value);
        $this->assertSame('reserved', $second->fresh()->status->value);
        $this->assertDatabaseCount('task_reservations', 2);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'reserved_slots' => 1]);
    }

    public function test_a_member_cannot_reserve_a_task_again_after_proof_was_submitted(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $this->approveBankAccount($member);
        $task = $this->makeTask($owner, 2);
        $reservation = app(TaskReservationService::class)->reserve($member, $task);
        $reservation->forceFill(['participation_claimed_at' => now()])->save();

        $this->actingAs($member, 'sanctum')->postJson('/api/tasks/'.$task->id.'/reserve')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('task');

        $this->assertDatabaseCount('task_reservations', 1);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'reserved_slots' => 1]);
    }

    public function test_expiration_can_release_a_reservation_after_changes_were_requested(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $this->approveBankAccount($member);
        $task = $this->makeTask($owner, 1);
        $reservation = app(TaskReservationService::class)->reserve($member, $task);
        $transitions = app(StatusTransitionService::class);
        $transitions->transition($reservation, 'proof_submitted');
        $transitions->transition($reservation, 'under_review');
        $transitions->transition($reservation, 'changes_requested', reason: 'Resubmit before expiry.');
        $reservation->forceFill(['expires_at' => now()->subMinute()])->save();

        (new ExpireReservationsJob)->handle(app(TaskReservationService::class), app(EventNotificationService::class));

        $this->assertSame('expired', $reservation->fresh()->status->value);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'reserved_slots' => 0]);
        $this->assertDatabaseHas('ledger_entries', [
            'task_reservation_id' => $reservation->id,
            'status' => LedgerStatus::CANCELLED->value,
        ]);
        $this->assertDatabaseHas('notification_outbox', [
            'user_id' => $member->id,
            'event_key' => 'reservation.expired.'.$reservation->id,
        ]);
    }

    private function makeTask(User $creator, int $slots): Task
    {
        return Task::create([
            'title' => 'Controlled reservation test',
            'slug' => 'controlled-reservation-test',
            'description' => 'An isolated test task.',
            'category' => 'testing',
            'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => '48.75',
            'incentive_amount' => '11.25',
            'expected_payout' => '60.00',
            'available_slots' => $slots,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
            'starts_at' => now()->subMinute(),
            'expires_at' => now()->addDay(),
            'created_by' => $creator->id,
        ]);
    }

    private function approveBankAccount(User $user): void
    {
        PayoutMethod::create([
            'user_id' => $user->id,
            'provider' => 'airwallex',
            'entity_type' => 'PERSONAL',
            'account_holder_name' => $user->name,
            'account_type' => 'bank',
            'country' => 'US',
            'currency' => 'USD',
            'transfer_method' => 'LOCAL',
            'routing_details' => ['account_routing_value1' => '0000000'.str_pad((string) $user->id, 3, '0', STR_PAD_LEFT)],
            'account_details' => ['account_number' => '00000000'.str_pad((string) $user->id, 4, '0', STR_PAD_LEFT)],
            'beneficiary_address' => [],
            'account_last4' => str_pad((string) ($user->id % 10000), 4, '0', STR_PAD_LEFT),
            'status' => 'active',
            'is_default' => true,
            'verification_status' => 'approved',
            'verification_submitted_at' => now()->subDay(),
            'verification_reviewed_at' => now(),
        ]);
    }
}
