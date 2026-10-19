<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicTaskEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_catalogue_exposes_only_available_safe_task_fields(): void
    {
        $owner = User::factory()->create();
        $available = $this->makeTask($owner, 'available', 'public-task');
        $this->makeTask($owner, 'paused', 'hidden-task');
        $full = $this->makeTask($owner, 'available', 'full-task');
        $full->forceFill(['reserved_slots' => 4])->save();
        $this->makeTask($owner, 'available', 'future-task', ['starts_at' => now()->addDay()]);
        $this->makeTask($owner, 'available', 'expired-task', ['expires_at' => now()->subMinute()]);

        $this->getJson('/api/public/tasks')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.meta.categories.0', 'Productivity')
            ->assertJsonPath('data.items.0.slug', $available->slug)
            ->assertJsonPath('data.items.0.expected_payout', 57)
            ->assertJsonPath('data.items.0.slots', 4)
            ->assertJsonMissingPath('data.items.0.external_checkout_url')
            ->assertJsonMissingPath('data.items.0.instructions')
            ->assertJsonMissingPath('data.items.0.requirements')
            ->assertJsonMissingPath('data.items.0.reserved_slots');
    }

    public function test_public_task_detail_uses_slug_and_hides_private_fields(): void
    {
        $task = $this->makeTask(User::factory()->create(), 'available', 'visible-task');

        $this->getJson('/api/public/tasks/'.$task->slug)
            ->assertOk()
            ->assertJsonPath('data.title', $task->title)
            ->assertJsonMissingPath('data.checkout_url')
            ->assertJsonMissingPath('data.instructions');
    }

    public function test_public_catalogue_filters_by_category_and_search(): void
    {
        $owner = User::factory()->create();
        $match = $this->makeTask($owner, 'available', 'matching-task');
        $other = $this->makeTask($owner, 'available', 'other-task', [
            'title' => 'A different public task',
            'category' => 'Learning',
        ]);

        $this->getJson('/api/public/tasks?category='.urlencode($match->category).'&search='.urlencode('catalogue'))
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.items.0.slug', $match->slug)
            ->assertJsonMissing(['slug' => $other->slug]);

        $this->getJson('/api/public/tasks?per_page=1000')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('per_page');
    }

    /** @param array<string, mixed> $overrides */
    private function makeTask(User $owner, string $status, string $slug, array $overrides = []): Task
    {
        return Task::create([
            'title' => 'Public catalogue task',
            'slug' => $slug,
            'description' => 'A concise public task summary that must not reveal its private completion instructions.',
            'category' => 'Productivity',
            'image_path' => '/task-images/productivity-template-bundle.jpg',
            'external_checkout_url' => 'https://example.invalid/private-checkout',
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => '57.00',
            'available_slots' => 4,
            'instructions' => ['private instruction'],
            'proof_requirements' => ['private requirement'],
            'status' => $status,
            'starts_at' => now()->subMinute(),
            'expires_at' => now()->addDay(),
            'created_by' => $owner->id,
            ...$overrides,
        ]);
    }
}
