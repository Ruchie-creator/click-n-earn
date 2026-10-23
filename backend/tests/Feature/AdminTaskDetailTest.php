<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\ReservationStatus;
use App\Enums\TaskStatus;
use App\Enums\UserRole;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTaskDetailTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_task_performance_metrics(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $member = User::factory()->create();
        $task = $this->createTask($admin);
        TaskReservation::create([
            'user_id' => $member->id,
            'task_id' => $task->id,
            'reimbursement_amount' => 20,
            'incentive_amount' => 5,
            'expected_payout' => 25,
            'status' => ReservationStatus::APPROVED,
            'reserved_at' => now()->subDay(),
            'submitted_at' => now(),
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/tasks/'.$task->id)
            ->assertOk()
            ->assertJsonPath('data.task.id', $task->id)
            ->assertJsonPath('data.metrics.reservations', 1)
            ->assertJsonPath('data.metrics.submissions', 1)
            ->assertJsonPath('data.metrics.approved', 1)
            ->assertJsonCount(14, 'data.trend')
            ->assertJsonCount(1, 'data.recent_activity');
    }

    public function test_force_delete_requires_the_exact_title_and_removes_reservations(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $member = User::factory()->create();
        $task = $this->createTask($admin);
        $reservation = TaskReservation::create([
            'user_id' => $member->id,
            'task_id' => $task->id,
            'reimbursement_amount' => 20,
            'incentive_amount' => 5,
            'expected_payout' => 25,
            'status' => ReservationStatus::RESERVED,
            'reserved_at' => now(),
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/tasks/'.$task->id.'/force-delete', ['confirmation' => 'wrong title'])
            ->assertUnprocessable();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/tasks/'.$task->id.'/force-delete', ['confirmation' => $task->title])
            ->assertOk()
            ->assertJsonPath('data.deleted', true);

        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
        $this->assertDatabaseMissing('task_reservations', ['id' => $reservation->id]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'task.force_deleted',
            'subject_id' => $task->id,
        ]);
    }

    private function createTask(User $admin): Task
    {
        return Task::create([
            'title' => 'Future-ready product task',
            'slug' => 'future-ready-product-task',
            'description' => 'Purchase the product and submit a valid receipt.',
            'category' => 'Research',
            'external_checkout_url' => 'https://example.com/product',
            'reimbursement_amount' => 20,
            'incentive_amount' => 5,
            'expected_payout' => 25,
            'available_slots' => 10,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => TaskStatus::AVAILABLE,
            'created_by' => $admin->id,
        ]);
    }
}
