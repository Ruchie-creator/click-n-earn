<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Payout;
use App\Models\Setting;
use App\Models\Task;
use App\Models\User;
use App\Services\BankAccountRequirement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BankAccountRequirementTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_keeps_bank_account_onboarding_required_by_default(): void
    {
        $this->postJson('/api/auth/register', $this->registrationPayload('required@example.com'))
            ->assertCreated()
            ->assertJsonPath('data.user.bank_account_required_for_tasks', true)
            ->assertJsonPath('data.user.eligible_to_reserve', false);
    }

    public function test_members_can_register_and_reserve_tasks_without_bank_details_when_requirement_is_disabled(): void
    {
        Setting::query()->where('key', BankAccountRequirement::SETTING_KEY)->update(['value' => ['enabled' => false]]);
        $member = User::factory()->create(['email_verified_at' => now()]);
        $task = $this->task();

        $this->actingAs($member, 'sanctum')->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.bank_account_required_for_tasks', false)
            ->assertJsonPath('data.eligible_to_reserve', true);
        $this->actingAs($member, 'sanctum')->getJson('/api/dashboard')->assertOk();
        $this->actingAs($member, 'sanctum')->getJson('/api/tasks')->assertOk();
        $this->actingAs($member, 'sanctum')->postJson('/api/tasks/'.$task->id.'/reserve')->assertCreated();

        $this->postJson('/api/auth/register', $this->registrationPayload('optional@example.com'))
            ->assertCreated()
            ->assertJsonPath('data.user.bank_account_required_for_tasks', false);
    }

    public function test_only_admins_can_change_the_bank_account_requirement(): void
    {
        $member = User::factory()->create();
        $admin = User::factory()->create(['role' => UserRole::ADMIN]);

        $this->actingAs($member, 'sanctum')
            ->patchJson('/api/admin/settings/'.BankAccountRequirement::SETTING_KEY, ['value' => ['enabled' => false]])
            ->assertForbidden();
        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/admin/settings/'.BankAccountRequirement::SETTING_KEY, ['value' => ['enabled' => false]])
            ->assertOk()
            ->assertJsonPath('data.value.enabled', false);
    }

    public function test_payout_release_is_rejected_without_an_approved_bank_account_even_when_requirement_is_disabled(): void
    {
        Setting::query()->where('key', BankAccountRequirement::SETTING_KEY)->update(['value' => ['enabled' => false]]);
        $member = User::factory()->create();
        $admin = User::factory()->create(['role' => UserRole::ADMIN]);
        $payout = Payout::create([
            'user_id' => $member->id,
            'provider' => 'airwallex',
            'provider_environment' => 'sandbox',
            'amount' => '12.00',
            'currency' => 'USD',
            'status' => 'approved',
            'idempotency_key' => 'bank-required-payout',
            'requested_at' => now(),
            'provider_request_id' => 'bank-required-payout-request',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/payouts/'.$payout->id.'/process')
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The member must add and have an approved bank account before this payout can be released.');
    }

    private function registrationPayload(string $email): array
    {
        return ['name' => 'New Member', 'email' => $email, 'password' => 'password123', 'password_confirmation' => 'password123'];
    }

    private function task(): Task
    {
        $owner = User::factory()->create(['role' => UserRole::ADMIN]);

        return Task::create([
            'title' => 'Bank optional task', 'slug' => 'bank-optional-task', 'description' => 'A task available without bank details.',
            'category' => 'testing', 'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => '10.00', 'incentive_amount' => '2.00', 'expected_payout' => '12.00',
            'available_slots' => 1, 'instructions' => [], 'proof_requirements' => [], 'status' => 'available',
            'starts_at' => now()->subMinute(), 'expires_at' => now()->addDay(), 'created_by' => $owner->id,
        ]);
    }
}
