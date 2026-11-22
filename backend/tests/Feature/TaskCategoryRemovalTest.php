<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskCategoryRemovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_a_task_without_category_metadata(): void
    {
        $admin = User::factory()->create(['role' => UserRole::ADMIN]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/tasks', [
            'title' => 'Uncategorized task',
            'description' => 'A task that does not require a category.',
            'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => 10,
            'incentive_amount' => 2,
            'available_slots' => 3,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.title', 'Uncategorized task');

        $taskId = $response->json('data.id');
        $this->assertDatabaseHas('tasks', [
            'id' => $taskId,
            'category' => null,
            'category_id' => null,
        ]);
    }

    public function test_active_uncategorized_task_is_visible_to_an_authenticated_member(): void
    {
        $member = User::factory()->create();
        $owner = User::factory()->create(['role' => UserRole::ADMIN]);
        $task = Task::create([
            'title' => 'Visible uncategorized task',
            'slug' => 'visible-uncategorized-task',
            'description' => 'A task that should appear immediately after publication.',
            'category' => null,
            'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => '10.00',
            'incentive_amount' => '2.00',
            'expected_payout' => '12.00',
            'available_slots' => 2,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
            'starts_at' => now()->subMinute(),
            'expires_at' => now()->addDay(),
            'created_by' => $owner->id,
        ]);

        $this->actingAs($member, 'sanctum')
            ->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonFragment(['id' => $task->id, 'availability_status' => 'available']);
    }
}
