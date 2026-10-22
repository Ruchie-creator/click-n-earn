<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Setting;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use Tests\TestCase;

class ReferralDescriptionAndTaskAvailabilityTest extends TestCase
{
    public function test_admins_can_create_update_and_clear_the_referral_page_description(): void
    {
        $admin = User::factory()->create(['role' => UserRole::ADMIN]);
        $member = User::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/admin/settings/referrals.page_description', ['value' => ['description' => "Invite trusted people.\nEarn after their first approved task."]])
            ->assertOk()
            ->assertJsonPath('data.value.description', "Invite trusted people.\nEarn after their first approved task.");

        $this->actingAs($member, 'sanctum')->getJson('/api/referrals')
            ->assertOk()
            ->assertJsonPath('data.page_description', "Invite trusted people.\nEarn after their first approved task.");

        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/admin/settings/referrals.page_description', ['value' => ['description' => 'Updated referral details.']])
            ->assertOk()
            ->assertJsonPath('data.value.description', 'Updated referral details.');
        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/admin/settings/referrals.page_description', ['value' => ['description' => '']])
            ->assertOk()
            ->assertJsonPath('data.value.description', null);

        $this->actingAs($member, 'sanctum')
            ->patchJson('/api/admin/settings/referrals.page_description', ['value' => ['description' => 'Not authorized']])
            ->assertForbidden();
    }

    public function test_completed_member_sees_purchased_task_even_when_it_is_globally_unavailable_and_cannot_reserve_again(): void
    {
        Setting::query()->where('key', 'onboarding.require_bank_account')->update(['value' => ['enabled' => false]]);
        $member = User::factory()->create();
        $otherMember = User::factory()->create();
        $task = $this->task();
        $reservation = TaskReservation::create([
            'user_id' => $member->id,
            'task_id' => $task->id,
            'reimbursement_amount' => '10.00',
            'incentive_amount' => '2.00',
            'expected_payout' => '12.00',
            'status' => 'paid',
            'reserved_at' => now()->subDay(),
            'completed_at' => now()->subHour(),
        ]);
        $reservation->forceFill(['participation_claimed_at' => now()->subDay()])->save();
        $task->forceFill(['status' => 'paused', 'reserved_slots' => 1])->save();

        $this->actingAs($member, 'sanctum')->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonFragment(['id' => $task->id, 'availability_status' => 'purchased']);
        $this->actingAs($member, 'sanctum')->getJson('/api/tasks/'.$task->id)
            ->assertOk()
            ->assertJsonPath('data.availability_status', 'purchased');
        $this->actingAs($member, 'sanctum')->postJson('/api/tasks/'.$task->id.'/reserve')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('task');
        $this->actingAs($otherMember, 'sanctum')->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 0);
    }

    public function test_an_available_task_is_available_to_a_member_without_a_purchase(): void
    {
        $member = User::factory()->create();
        $task = $this->task();

        $this->actingAs($member, 'sanctum')->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonFragment(['id' => $task->id, 'availability_status' => 'available']);
    }

    private function task(): Task
    {
        $owner = User::factory()->create(['role' => UserRole::ADMIN]);

        return Task::create([
            'title' => 'Availability test task',
            'slug' => 'availability-test-task-'.fake()->unique()->uuid(),
            'description' => 'A task used to verify member-specific availability.',
            'category' => 'Testing',
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
    }
}
