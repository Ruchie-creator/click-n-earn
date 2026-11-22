<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\TaskStatus;
use App\Enums\UserRole;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StructuredTaskContentTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_content_is_sanitized_and_returned_to_member_and_public_payloads(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
            'email_verified_at' => now(),
        ]);
        $payload = [
            'title' => 'Structured content task',
            'description' => 'Legacy fallback description.',
            'external_checkout_url' => 'https://example.com/checkout',
            'reimbursement_amount' => 20,
            'incentive_amount' => 5,
            'available_slots' => 10,
            'instructions' => ['Legacy step'],
            'proof_requirements' => ['Receipt'],
            'status' => 'available',
            'content' => [
                'overview_html' => '<p>Overview <script>alert(1)</script><strong>safe</strong></p>',
                'terms_html' => '<p>Terms</p>',
                'verification_time' => '24–48 hours',
                'upload_guidance' => '<p>JPG or PDF</p>',
                'steps' => [['id' => 'step-1', 'title' => 'Buy', 'body' => '<p>Make a genuine purchase.</p>']],
                'dos' => [['title' => 'Keep proof', 'body' => 'Keep the original receipt.']],
                'donts' => [['title' => 'No edits', 'body' => '<em>Do not alter proof.</em>']],
                'faqs' => [['question' => 'When is it paid?', 'answer' => 'After approval.']],
            ],
        ];

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/tasks', $payload)->assertCreated();
        $taskId = $response->json('data.id');
        $this->assertDatabaseHas('tasks', ['id' => $taskId]);
        $this->assertStringNotContainsString('<script>', $response->json('data.content.overview_html'));
        $this->assertSame('step-1', $response->json('data.content.steps.0.id'));

        $this->getJson('/api/public/tasks/structured-content-task-'.substr(sha1((string) $taskId), 0, 5))
            ->assertNotFound();

        $task = Task::findOrFail($taskId);
        $this->getJson('/api/public/tasks/'.$task->slug)
            ->assertOk()
            ->assertJsonPath('data.content.verification_time', '24–48 hours')
            ->assertJsonPath('data.content.faqs.0.question', 'When is it paid?');

        $member = User::factory()->create(['account_status' => AccountStatus::ACTIVE]);
        $this->actingAs($member, 'sanctum')
            ->getJson('/api/tasks/'.$task->id)
            ->assertOk()
            ->assertJsonPath('data.content.steps.0.title', 'Buy');
    }
}
