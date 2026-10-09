<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\ProofSubmission;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use App\Services\LedgerService;
use App\Services\StatusTransitionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ProofSubmissionSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_expired_reservation_cannot_accept_proof(): void
    {
        Storage::fake('proofs');
        [$user, , $reservation] = $this->reservationFixture(expired: true);

        $this->submitProof($user, $reservation, $this->pdf(), 'proof-expired-request-0001')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertDatabaseCount('proof_submissions', 0);
        $this->assertDatabaseHas('task_reservations', [
            'id' => $reservation->id,
            'status' => 'reserved',
        ]);
        Storage::disk('proofs')->assertDirectoryEmpty('proofs/'.$user->id.'/'.$reservation->id);
    }

    public function test_upload_is_private_and_retrying_the_same_idempotent_request_creates_one_proof(): void
    {
        Queue::fake();
        Storage::fake('proofs');
        [$owner, , $reservation] = $this->reservationFixture();
        $file = $this->pdf();
        $key = 'proof-retry-request-0001';

        $response = $this->submitProof($owner, $reservation, $file, $key)->assertCreated();
        $proofId = $response->json('data.id');
        $proof = ProofSubmission::findOrFail($proofId);

        $this->assertSame('proofs/'.$owner->id.'/'.$reservation->id.'/'.basename($proof->file_path), $proof->file_path);
        $this->assertSame('receipt_report.pdf', $proof->original_file_name);
        $this->assertTrue($proof->is_current);
        Storage::disk('proofs')->assertExists($proof->file_path);

        $this->submitProof($owner, $reservation, $file, $key)
            ->assertOk()
            ->assertJsonPath('data.id', $proofId);

        $this->assertDatabaseCount('proof_submissions', 1);
        $this->assertDatabaseCount('notification_outbox', 1);
        $this->assertDatabaseCount('notifications', 1);

        $otherMember = User::factory()->create(['account_status' => AccountStatus::ACTIVE]);
        $this->actingAs($otherMember, 'sanctum')->get('/api/proof/'.$proofId.'/download')->assertNotFound();
        $this->actingAs($owner, 'sanctum')->get('/api/proof/'.$proofId.'/download')->assertOk();

        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $this->actingAs($admin, 'sanctum')->get('/api/proof/'.$proofId.'/download')->assertOk();
    }

    public function test_non_owner_cannot_attach_a_proof_to_another_members_reservation(): void
    {
        [$owner, , $reservation] = $this->reservationFixture();
        $otherMember = User::factory()->create(['account_status' => AccountStatus::ACTIVE]);

        $this->actingAs($otherMember, 'sanctum')
            ->withHeader('Accept', 'application/json')
            ->post('/api/reservations/'.$reservation->id.'/proof', [])
            ->assertNotFound();

        $this->assertDatabaseCount('proof_submissions', 0);
        $this->assertDatabaseHas('task_reservations', ['id' => $reservation->id, 'user_id' => $owner->id]);
    }

    public function test_invalid_file_type_and_configured_size_limit_are_rejected(): void
    {
        Storage::fake('proofs');
        [$user, , $reservation] = $this->reservationFixture();

        $this->submitProof(
            $user,
            $reservation,
            UploadedFile::fake()->create('script.exe', 1, 'application/octet-stream'),
            'proof-invalid-type-request-01',
        )->assertUnprocessable()->assertJsonValidationErrors('proof');

        config(['verification.max_proof_size_kb' => 1]);
        $this->submitProof(
            $user,
            $reservation,
            UploadedFile::fake()->create('large.pdf', 2, 'application/pdf'),
            'proof-oversized-request-0001',
        )->assertUnprocessable()->assertJsonValidationErrors('proof');

        $this->assertDatabaseCount('proof_submissions', 0);
        Storage::disk('proofs')->assertDirectoryEmpty('proofs/'.$user->id.'/'.$reservation->id);
    }

    public function test_changes_requested_proof_can_be_resubmitted_as_a_new_current_version(): void
    {
        Queue::fake();
        Storage::fake('proofs');
        [$user, , $reservation] = $this->reservationFixture();
        $admin = User::factory()->create(['role' => UserRole::ADMIN]);
        app(LedgerService::class)->reserveTaskReward($reservation);
        $transitions = app(StatusTransitionService::class);
        $transitions->transition($reservation, 'proof_submitted');
        $transitions->transition($reservation, 'under_review');

        $reference = 'resubmission-reference-20261007';
        $previous = ProofSubmission::create([
            'task_reservation_id' => $reservation->id,
            'user_id' => $user->id,
            'version' => 1,
            'file_disk' => 'proofs',
            'file_path' => 'proofs/'.$user->id.'/'.$reservation->id.'/v1-previous.pdf',
            'original_file_name' => 'previous.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 128,
            'file_sha256' => hash('sha256', 'previous-proof-bytes'),
            'transaction_reference_key' => hash('sha256', mb_strtolower($reference)),
            'is_current' => true,
            'purchase_amount' => '47.00',
            'purchase_date' => '2026-10-07',
            'transaction_reference' => $reference,
            'status' => 'under_review',
            'submitted_at' => now()->subMinutes(20),
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/submissions/'.$previous->id.'/request-changes', ['reason' => 'Please upload a clearer receipt.'])
            ->assertOk();

        $resubmission = $this->actingAs($user, 'sanctum')
            ->withHeaders([
                'Accept' => 'application/json',
                'Idempotency-Key' => 'proof-resubmit-request-0001',
            ])
            ->post('/api/reservations/'.$reservation->id.'/proof', [
                'proof' => $this->pdf(),
                'purchase_amount' => '47.00',
                'purchase_date' => '2026-10-07',
                'transaction_reference' => $reference,
                'user_note' => 'Updated clear receipt.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.version', 2);

        $current = ProofSubmission::findOrFail($resubmission->json('data.id'));
        $this->assertSame($previous->id, $current->previous_submission_id);
        $this->assertTrue($current->is_current);
        $this->assertFalse($previous->fresh()->is_current);
        $this->assertSame('proof_submitted', $reservation->fresh()->status->value);
        $this->assertDatabaseCount('proof_submissions', 2);
        $this->assertDatabaseCount('ledger_entries', 2);
        $this->assertDatabaseHas('proof_submissions', ['id' => $current->id, 'version' => 2, 'is_current' => true]);
    }

    /** @return array{User, Task, TaskReservation} */
    private function reservationFixture(bool $expired = false): array
    {
        $user = User::factory()->create(['account_status' => AccountStatus::ACTIVE]);
        $task = Task::create([
            'title' => 'Proof safety task',
            'slug' => 'proof-safety-task',
            'description' => 'Controlled proof submission test.',
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
            'created_by' => $user->id,
        ]);
        $task->forceFill(['reserved_slots' => 1])->save();
        $reservation = TaskReservation::create([
            'user_id' => $user->id,
            'task_id' => $task->id,
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => '57.00',
            'status' => 'reserved',
            'reserved_at' => now()->subMinutes(5),
            'expires_at' => $expired ? now()->subMinute() : now()->addDay(),
        ]);

        return [$user, $task, $reservation];
    }

    private function submitProof(User $user, TaskReservation $reservation, UploadedFile $file, string $key): TestResponse
    {
        return $this->actingAs($user, 'sanctum')
            ->withHeaders([
                'Accept' => 'application/json',
                'Idempotency-Key' => $key,
            ])
            ->post('/api/reservations/'.$reservation->id.'/proof', [
                'proof' => $file,
                'purchase_amount' => '47.00',
                'purchase_date' => '2026-10-07',
                'transaction_reference' => 'proof-safety-reference-20261007',
                'user_note' => 'Controlled proof test.',
            ]);
    }

    private function pdf(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            'receipt report.pdf',
            "%PDF-1.4\nControlled test receipt\n%%EOF\n",
        );
    }
}
