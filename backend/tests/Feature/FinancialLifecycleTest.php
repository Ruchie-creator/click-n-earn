<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\LedgerStatus;
use App\Enums\UserRole;
use App\Jobs\ProcessAirwallexWebhookJob;
use App\Models\Payout;
use App\Models\PayoutMethod;
use App\Models\ProofSubmission;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use App\Models\WebhookEvent;
use App\Services\LedgerService;
use App\Services\PayoutService;
use App\Services\VerificationService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class FinancialLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_approval_and_fake_paid_processing_are_idempotent_and_link_the_ledger(): void
    {
        Queue::fake();
        config([
            'payout.driver' => 'fake',
            'payout.fake_outcome' => 'paid',
            'payout.currency' => 'USD',
        ]);

        $member = User::factory()->create(['account_status' => AccountStatus::ACTIVE]);
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $task = Task::create([
            'title' => 'Lifecycle test task',
            'slug' => 'lifecycle-test-task',
            'description' => 'Controlled financial lifecycle test.',
            'category' => 'testing',
            'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => '57.00',
            'available_slots' => 1,
            'reserved_slots' => 1,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
            'created_by' => $admin->id,
        ]);
        $task->forceFill(['reserved_slots' => 1])->save();
        $reservation = TaskReservation::create([
            'user_id' => $member->id,
            'task_id' => $task->id,
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => Money::add('47.00', '10.00'),
            'status' => 'under_review',
            'reserved_at' => now()->subHour(),
            'submitted_at' => now()->subMinutes(20),
            'expires_at' => now()->addDay(),
        ]);
        $proof = ProofSubmission::create([
            'task_reservation_id' => $reservation->id,
            'user_id' => $member->id,
            'version' => 1,
            'file_disk' => 'proofs',
            'file_path' => 'proofs/'.$member->id.'/'.$reservation->id.'/v1-controlled.pdf',
            'original_file_name' => 'receipt.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 128,
            'file_sha256' => hash('sha256', 'controlled-lifecycle-proof'),
            'is_current' => true,
            'purchase_amount' => '47.00',
            'purchase_date' => now()->toDateString(),
            'transaction_reference' => 'lifecycle-test-reference',
            'status' => 'under_review',
            'submitted_at' => now()->subMinutes(20),
        ]);
        app(\App\Services\LedgerService::class)->reserveTaskReward($reservation);

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

        $this->actingAs($member, 'sanctum')
            ->postJson('/api/admin/submissions/'.$proof->id.'/approve')
            ->assertForbidden();

        $verification = app(VerificationService::class);
        $approved = $verification->approve($proof, $admin->id);
        $retriedApproval = $verification->approve($proof, $admin->id);
        $payout = $approved['payout'];

        $this->assertSame($payout->id, $retriedApproval['payout']->id);
        $this->assertSame('approved', $reservation->fresh()->status->value);
        $this->assertNotNull($reservation->fresh()->approved_at);
        $this->assertSame('approved', $proof->fresh()->status);
        $this->assertDatabaseCount('payouts', 1);
        $this->assertDatabaseCount('ledger_entries', 2);
        $this->assertDatabaseHas('ledger_entries', [
            'task_reservation_id' => $reservation->id,
            'payout_id' => $payout->id,
            'status' => LedgerStatus::PENDING->value,
        ]);

        $payoutService = app(PayoutService::class);
        $paid = $payoutService->process($payout);
        $payoutService->process($payout);

        $this->assertSame('paid', $paid->fresh()->status->value);
        $this->assertSame('paid', $reservation->fresh()->status->value);
        $this->assertNotNull($reservation->fresh()->completed_at);
        $this->assertDatabaseHas('tasks', [
            'id' => $task->id,
            'reserved_slots' => 0,
            'completed_slots' => 1,
        ]);
        $this->assertDatabaseCount('payouts', 1);
        $this->assertDatabaseCount('ledger_entries', 2);
        $this->assertDatabaseMissing('ledger_entries', [
            'task_reservation_id' => $reservation->id,
            'status' => LedgerStatus::PENDING->value,
        ]);
        $this->assertDatabaseHas('ledger_entries', [
            'task_reservation_id' => $reservation->id,
            'payout_id' => $payout->id,
            'status' => LedgerStatus::PAID->value,
        ]);
        $this->assertDatabaseCount('notification_outbox', 2);
        $this->assertDatabaseHas('notification_outbox', [
            'user_id' => $member->id,
            'event_key' => 'proof.approved.'.$proof->id,
        ]);
        $this->assertDatabaseHas('notification_outbox', [
            'user_id' => $member->id,
            'event_key' => 'payout.paid.'.$payout->id,
        ]);
    }

    public function test_duplicate_signed_airwallex_webhook_delivery_does_not_duplicate_payout_effects(): void
    {
        Queue::fake();
        $secret = 'controlled-test-webhook-secret';
        config([
            'payout.driver' => 'airwallex',
            'payout.airwallex.webhook_secret' => $secret,
        ]);

        $member = User::factory()->create(['account_status' => AccountStatus::ACTIVE]);
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $task = Task::create([
            'title' => 'Webhook lifecycle task',
            'slug' => 'webhook-lifecycle-task',
            'description' => 'Controlled webhook idempotency test.',
            'category' => 'testing',
            'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => '57.00',
            'available_slots' => 1,
            'reserved_slots' => 1,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
            'created_by' => $admin->id,
        ]);
        $task->forceFill(['reserved_slots' => 1])->save();
        $reservation = TaskReservation::create([
            'user_id' => $member->id,
            'task_id' => $task->id,
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => '57.00',
            'status' => 'processing',
            'reserved_at' => now()->subHour(),
            'approved_at' => now()->subMinutes(30),
            'expires_at' => now()->addDay(),
        ]);
        $ledger = app(LedgerService::class);
        $ledger->reserveTaskReward($reservation);
        $ledger->updateReservationStatus($reservation, LedgerStatus::PROCESSING);
        $payout = Payout::create([
            'user_id' => $member->id,
            'task_reservation_id' => $reservation->id,
            'provider' => 'airwallex',
            'amount' => '57.00',
            'currency' => 'USD',
            'status' => 'processing',
            'provider_reference' => 'awx-controlled-transfer-1001',
            'idempotency_key' => 'reservation-'.$reservation->id,
            'requested_at' => now()->subMinutes(30),
            'processing_at' => now()->subMinutes(20),
        ]);
        $reservation->ledgerEntries()->update(['payout_id' => $payout->id]);

        $payload = [
            'id' => 'awx-controlled-event-1001',
            'name' => 'transfer.paid',
            'data' => [
                'object' => [
                    'id' => 'awx-controlled-transfer-1001',
                    'status' => 'PAID',
                    'request_id' => 'reservation-'.$reservation->id,
                ],
            ],
        ];
        $content = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $timestamp = (string) now()->timestamp;
        $signature = hash_hmac('sha256', $timestamp.$content, $secret);
        $server = [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_TIMESTAMP' => $timestamp,
            'HTTP_X_SIGNATURE' => $signature,
            'HTTP_X_EVENT_ID' => 'awx-controlled-event-1001',
            'HTTP_X_EVENT_NAME' => 'transfer.paid',
        ];

        $this->call('POST', '/api/webhooks/airwallex', [], [], [], $server, $content)->assertOk();
        $event = WebhookEvent::query()->where('provider', 'airwallex')->where('event_id', 'awx-controlled-event-1001')->firstOrFail();

        $job = new ProcessAirwallexWebhookJob($event->id);
        $job->handle(app(\App\Services\PayoutService::class));
        $this->call('POST', '/api/webhooks/airwallex', [], [], [], $server, $content)->assertOk();
        $job->handle(app(\App\Services\PayoutService::class));

        $this->assertSame('processed', $event->fresh()->status);
        $this->assertSame('paid', $payout->fresh()->status->value);
        $this->assertSame('paid', $reservation->fresh()->status->value);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'reserved_slots' => 0, 'completed_slots' => 1]);
        $this->assertDatabaseCount('webhook_events', 1);
        $this->assertDatabaseCount('payouts', 1);
        $this->assertDatabaseCount('ledger_entries', 2);
        $this->assertDatabaseHas('ledger_entries', [
            'task_reservation_id' => $reservation->id,
            'payout_id' => $payout->id,
            'status' => LedgerStatus::PAID->value,
        ]);
        $this->assertDatabaseCount('notification_outbox', 1);
        $this->assertDatabaseCount('notifications', 1);
    }

    public function test_admin_can_idempotently_reject_submitted_proof_and_release_capacity(): void
    {
        Queue::fake();
        $member = User::factory()->create(['account_status' => AccountStatus::ACTIVE]);
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $task = Task::create([
            'title' => 'Proof rejection test',
            'slug' => 'proof-rejection-test',
            'description' => 'Controlled proof rejection test.',
            'category' => 'testing',
            'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => '57.00',
            'available_slots' => 1,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
            'created_by' => $admin->id,
        ]);
        $task->forceFill(['reserved_slots' => 1])->save();
        $reservation = TaskReservation::create([
            'user_id' => $member->id,
            'task_id' => $task->id,
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => '57.00',
            'status' => 'proof_submitted',
            'reserved_at' => now()->subHour(),
            'submitted_at' => now()->subMinutes(20),
            'expires_at' => now()->addDay(),
        ]);
        $proof = ProofSubmission::create([
            'task_reservation_id' => $reservation->id,
            'user_id' => $member->id,
            'version' => 1,
            'file_disk' => 'proofs',
            'file_path' => 'proofs/'.$member->id.'/'.$reservation->id.'/v1-controlled.pdf',
            'original_file_name' => 'receipt.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 128,
            'file_sha256' => hash('sha256', 'controlled-rejection-proof'),
            'is_current' => true,
            'purchase_amount' => '47.00',
            'purchase_date' => now()->toDateString(),
            'transaction_reference' => 'proof-rejection-test-reference',
            'status' => 'proof_submitted',
            'submitted_at' => now()->subMinutes(20),
        ]);
        app(LedgerService::class)->reserveTaskReward($reservation);

        $verification = app(VerificationService::class);
        $rejected = $verification->reject($proof, $admin->id, 'The receipt is not readable.');
        $retried = $verification->reject($proof, $admin->id, 'The receipt is not readable.');

        $this->assertSame($rejected->id, $retried->id);
        $this->assertSame('rejected', $reservation->fresh()->status->value);
        $this->assertSame('rejected', $proof->fresh()->status);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'reserved_slots' => 0]);
        $this->assertDatabaseCount('ledger_entries', 2);
        $this->assertDatabaseMissing('ledger_entries', [
            'task_reservation_id' => $reservation->id,
            'status' => LedgerStatus::RESERVED->value,
        ]);
        $this->assertDatabaseCount('payouts', 0);
        $this->assertDatabaseCount('notification_outbox', 1);
        $this->assertDatabaseHas('notification_outbox', [
            'user_id' => $member->id,
            'event_key' => 'proof.rejected.'.$proof->id,
        ]);
    }
}
