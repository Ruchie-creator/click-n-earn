<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Payout;
use App\Models\PayoutMethod;
use App\Models\Referral;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use App\Services\ReferralService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class OnboardingGovernanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'payout.airwallex.environment' => 'sandbox',
            'payout.airwallex.sandbox.base_url' => 'https://api.sandbox.airwallex.com/api/v1',
            'payout.airwallex.sandbox.client_id' => 'sandbox-client',
            'payout.airwallex.sandbox.api_key' => 'sandbox-key',
        ]);
        Queue::fake();
    }

    public function test_bank_submission_is_encrypted_and_admin_approval_unlocks_reservations(): void
    {
        $this->fakeBankValidation();
        $member = User::factory()->create(['email_verified_at' => now()]);
        $admin = $this->makeAdmin();
        $task = $this->makeTask($admin, 'bank-approval-task');

        $this->actingAs($member, 'sanctum')
            ->postJson('/api/payout-methods', $this->bankPayload('50001121'))
            ->assertCreated()
            ->assertJsonPath('data.verification_status', 'pending_review')
            ->assertJsonPath('data.masked_account', '****1121');

        $method = PayoutMethod::query()->where('user_id', $member->id)->firstOrFail();
        $this->assertDatabaseHas('notification_outbox', [
            'user_id' => $admin->id,
            'event_key' => 'payout_verification.submitted.'.$method->id.'.admin.'.$admin->id,
        ]);
        $rawAccount = DB::table('payout_methods')->where('id', $method->id)->value('account_details');
        $this->assertStringNotContainsString('50001121', (string) $rawAccount);
        $this->actingAs($member, 'sanctum')->getJson('/api/payout-methods')
            ->assertOk()
            ->assertJsonMissingPath('data.0.account_details')
            ->assertJsonPath('data.0.masked_account', '****1121');

        $this->actingAs($member, 'sanctum')
            ->postJson('/api/tasks/'.$task->id.'/reserve')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('eligibility');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/payout-verifications/'.$method->id)
            ->assertOk()
            ->assertJsonPath('data.bank_details.account_details.account_number', '50001121');
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/payout-verifications/'.$method->id.'/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->actingAs($member->fresh(), 'sanctum')
            ->postJson('/api/tasks/'.$task->id.'/reserve')
            ->assertCreated();
        $this->assertDatabaseHas('audit_logs', ['action' => 'payout_method.approved']);
    }

    public function test_approved_bank_change_requires_new_review_without_detaching_existing_payouts(): void
    {
        $this->fakeBankValidation();
        $member = User::factory()->create(['email_verified_at' => now()]);
        $oldMethod = $this->makeApprovedMethod($member, '50001121');
        $payout = Payout::create([
            'user_id' => $member->id,
            'payout_method_id' => $oldMethod->id,
            'provider' => 'airwallex',
            'provider_environment' => 'sandbox',
            'amount' => '12.00',
            'currency' => 'USD',
            'status' => 'approved',
            'idempotency_key' => 'existing-approved-payment',
            'requested_at' => now(),
        ]);

        $this->actingAs($member, 'sanctum')
            ->putJson('/api/payout-methods/'.$oldMethod->id, $this->bankPayload('50002222'))
            ->assertOk()
            ->assertJsonPath('data.verification_status', 'pending_review');

        $this->assertSame('superseded', $oldMethod->fresh()->verification_status);
        $this->assertSame('active', $oldMethod->fresh()->status);
        $this->assertFalse($oldMethod->fresh()->is_default);
        $this->assertSame('approved', $payout->fresh()->status->value);
        $this->assertSame($oldMethod->id, $payout->fresh()->payout_method_id);
        $this->assertDatabaseHas('payout_method_reviews', [
            'payout_method_id' => $oldMethod->id,
            'action' => 'superseded',
        ]);
        $this->actingAs($member->fresh(), 'sanctum')->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.eligible_to_reserve', false)
            ->assertJsonPath('data.payout_verification_status', 'pending_review');
    }

    public function test_matching_bank_identifiers_are_held_for_administrator_resolution(): void
    {
        $this->fakeBankValidation();
        $firstMember = User::factory()->create(['email_verified_at' => now()]);
        $secondMember = User::factory()->create(['email_verified_at' => now()]);
        $admin = $this->makeAdmin();

        $this->actingAs($firstMember, 'sanctum')->postJson('/api/payout-methods', $this->bankPayload('50001121'))->assertCreated();
        $this->actingAs($secondMember, 'sanctum')->postJson('/api/payout-methods', $this->bankPayload('50001121'))
            ->assertCreated()
            ->assertJsonPath('data.duplicate_review_required', true);

        $method = PayoutMethod::query()->where('user_id', $secondMember->id)->firstOrFail();
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/payout-verifications/'.$method->id.'/approve')
            ->assertUnprocessable();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/payout-verifications/'.$method->id)
            ->assertOk()
            ->assertJsonPath('data.duplicate_review_required', true)
            ->assertJsonCount(1, 'data.duplicate_matches')
            ->assertJsonPath('data.duplicate_matches.0.masked_account', '****1121');

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/payout-verifications/'.$method->id.'/resolve-duplicate', ['reason' => 'Reviewed the matching account details.'])
            ->assertOk()
            ->assertJsonPath('data.count', 2);
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/payout-verifications/'.$method->id.'/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->assertNotNull($method->fresh()->duplicate_resolved_at);
        $this->assertNotNull($method->fresh()->duplicate_resolved_by);
    }

    public function test_admin_manages_faqs_and_categories_without_breaking_existing_tasks(): void
    {
        $admin = $this->makeAdmin();
        $member = User::factory()->create();

        $this->actingAs($member, 'sanctum')->getJson('/api/admin/faqs')->assertForbidden();

        $faq = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/faqs', [
                'category' => 'Account setup',
                'question' => 'How are bank details reviewed?',
                'answer' => '<script>alert("safe text")</script>',
                'is_published' => false,
                'sort_order' => 12,
            ])
            ->assertCreated()
            ->assertJsonPath('data.is_published', false);

        $faqId = $faq->json('data.id');
        $this->getJson('/api/public/faqs')->assertJsonMissing(['question' => 'How are bank details reviewed?']);
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/faqs/'.$faqId, ['is_published' => true])->assertOk();
        $this->getJson('/api/public/faqs')
            ->assertJsonFragment(['question' => 'How are bank details reviewed?'])
            ->assertJsonFragment(['answer' => '<script>alert("safe text")</script>']);

        $category = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/task-categories', ['name' => 'Creator Tools'])
            ->assertCreated();
        $categoryId = $category->json('data.id');
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/task-categories', ['name' => 'creator tools'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $task = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/tasks', [
                'title' => 'Category preservation task',
                'description' => 'Task used to verify category changes.',
                'category_id' => $categoryId,
                'external_checkout_url' => 'https://example.invalid/checkout',
                'reimbursement_amount' => '10.00',
                'incentive_amount' => '3.00',
                'available_slots' => 2,
                'instructions' => ['Follow the instructions.'],
                'proof_requirements' => ['Upload a readable proof.'],
                'status' => 'available',
            ])
            ->assertCreated();
        $taskId = $task->json('data.id');

        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/admin/task-categories/'.$categoryId, ['name' => 'Creator Resources'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Creator Resources');
        $this->assertDatabaseHas('tasks', ['id' => $taskId, 'category_id' => $categoryId, 'category' => 'Creator Resources']);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson('/api/admin/task-categories/'.$categoryId)
            ->assertOk()
            ->assertJsonPath('data.archived', true);
        $this->assertDatabaseHas('task_categories', ['id' => $categoryId, 'is_active' => false]);
        $this->assertDatabaseHas('tasks', ['id' => $taskId, 'category_id' => $categoryId, 'category' => 'Creator Resources']);

        $this->actingAs($admin, 'sanctum')->deleteJson('/api/admin/faqs/'.$faqId)->assertOk();
        $this->getJson('/api/public/faqs')->assertJsonMissing(['question' => 'How are bank details reviewed?']);
    }

    public function test_referral_qualifies_once_and_uses_the_existing_recorded_payout_flow(): void
    {
        $referrer = User::factory()->create();
        $referredMember = User::factory()->create();
        $admin = $this->makeAdmin();
        $this->makeApprovedMethod($referrer, '50001121');
        $referral = Referral::create([
            'referrer_id' => $referrer->id,
            'referred_user_id' => $referredMember->id,
            'referral_code' => 'INVITE123',
            'registered_at' => now()->subDay(),
            'reward_amount' => '12.00',
            'reward_status' => 'pending',
        ]);
        $firstReservation = $this->makeApprovedReservation($referredMember, $admin, 'first-approved-purchase');

        app(ReferralService::class)->qualifyAfterApprovedTask($referredMember, $firstReservation);
        $this->assertNull(app(ReferralService::class)->qualifyAfterApprovedTask(
            $referredMember,
            $this->makeApprovedReservation($referredMember, $admin, 'later-approved-purchase'),
        ));
        $this->assertDatabaseHas('referrals', [
            'id' => $referral->id,
            'qualifying_task_reservation_id' => $firstReservation->id,
            'reward_status' => 'pending_approval',
        ]);
        $this->assertDatabaseCount('ledger_entries', 1);

        $this->actingAs($referredMember, 'sanctum')->getJson('/api/admin/referrals')->assertForbidden();
        $approved = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/referrals/'.$referral->id.'/approve', ['note' => 'First approved qualifying purchase.'])
            ->assertOk()
            ->assertJsonPath('data.referral.reward_status', 'approved');
        $payoutId = $approved->json('data.payout_id');
        $this->assertDatabaseCount('payouts', 1);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/payouts/'.$payoutId.'/mark-paid', ['reference' => 'manual-referral-proof-001', 'note' => 'Confirmed in the external bank statement.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');
        $this->assertDatabaseHas('referrals', ['id' => $referral->id, 'reward_status' => 'paid']);
        $this->assertDatabaseHas('ledger_entries', ['referral_id' => $referral->id, 'status' => 'paid']);
        $this->assertDatabaseHas('payouts', ['id' => $payoutId, 'manual_reference' => 'manual-referral-proof-001']);
    }

    private function fakeBankValidation(): void
    {
        Http::fake([
            'https://api.sandbox.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'sandbox-token'], 201),
            'https://api.sandbox.airwallex.com/api/v1/beneficiaries/validate' => Http::response([], 200),
        ]);
    }

    /** @return array<string, mixed> */
    private function bankPayload(string $accountNumber): array
    {
        return [
            'account_holder_name' => 'Example Member',
            'entity_type' => 'PERSONAL',
            'transfer_method' => 'LOCAL',
            'country' => 'US',
            'currency' => 'USD',
            'is_default' => true,
            'routing_details' => [
                'local_clearing_system' => 'ACH',
                'bank_account_category' => 'CHECKING',
                'account_routing_type1' => 'ABA',
                'account_routing_value1' => '021000021',
            ],
            'account_details' => ['account_number' => $accountNumber, 'type' => 'BANK_ACCOUNT'],
            'beneficiary_address' => ['country_code' => 'US', 'state' => 'US-WA', 'city' => 'Seattle', 'postcode' => '98104', 'street_address' => '412 5th Avenue'],
        ];
    }

    private function makeAdmin(): User
    {
        return User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'email_verified_at' => now(),
        ]);
    }

    private function makeApprovedMethod(User $user, string $accountNumber): PayoutMethod
    {
        return PayoutMethod::create([
            'user_id' => $user->id,
            'provider' => 'airwallex',
            'entity_type' => 'PERSONAL',
            'account_holder_name' => $user->name,
            'account_type' => 'bank',
            'country' => 'US',
            'currency' => 'USD',
            'transfer_method' => 'LOCAL',
            'routing_details' => ['account_routing_value1' => '021000021'],
            'account_details' => ['account_number' => $accountNumber],
            'beneficiary_address' => ['country_code' => 'US'],
            'account_last4' => substr($accountNumber, -4),
            'status' => 'active',
            'is_default' => true,
            'verification_status' => 'approved',
            'verification_submitted_at' => now()->subDay(),
            'verification_reviewed_at' => now(),
        ]);
    }

    private function makeTask(User $owner, string $slug): Task
    {
        return Task::create([
            'title' => str($slug)->replace('-', ' ')->title()->toString(),
            'slug' => $slug,
            'description' => 'Task for the onboarding governance feature test.',
            'category' => 'Testing',
            'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => '10.00',
            'incentive_amount' => '2.00',
            'expected_payout' => '12.00',
            'available_slots' => 3,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
            'starts_at' => now()->subMinute(),
            'expires_at' => now()->addDay(),
            'created_by' => $owner->id,
        ]);
    }

    private function makeApprovedReservation(User $member, User $owner, string $slug): TaskReservation
    {
        $task = $this->makeTask($owner, $slug);

        return TaskReservation::create([
            'user_id' => $member->id,
            'task_id' => $task->id,
            'reimbursement_amount' => '10.00',
            'incentive_amount' => '2.00',
            'expected_payout' => '12.00',
            'status' => 'approved',
            'reserved_at' => now()->subHour(),
            'submitted_at' => now()->subMinutes(30),
            'approved_at' => now(),
            'expires_at' => now()->addDay(),
        ]);
    }
}
