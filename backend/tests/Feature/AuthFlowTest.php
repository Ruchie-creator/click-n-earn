<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Jobs\SendNotificationEmailJob;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_member_can_register_and_receive_a_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'New Member',
            'email' => 'new-member@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user.role', 'member')
            ->assertJsonStructure(['data' => ['user', 'token', 'token_type']]);

        $this->assertDatabaseHas('users', [
            'email' => 'new-member@example.com',
            'role' => UserRole::MEMBER->value,
        ]);
    }

    public function test_duplicate_registration_is_rejected(): void
    {
        User::factory()->create(['email' => 'duplicate@example.com']);

        $this->postJson('/api/auth/register', [
            'name' => 'Duplicate Member',
            'email' => 'duplicate@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_a_member_can_login_and_fetch_me(): void
    {
        $user = User::factory()->create([
            'email' => 'member@example.com',
            'password' => Hash::make('password123'),
            'role' => UserRole::MEMBER,
            'account_status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'member@example.com',
            'password' => 'password123',
        ])->assertOk();

        $token = $response->json('data.token');

        $this->withToken($token)->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    }

    public function test_invalid_password_is_rejected(): void
    {
        User::factory()->create([
            'email' => 'member@example.com',
            'password' => Hash::make('password123'),
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'member@example.com',
            'password' => 'wrong-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_unauthenticated_me_returns_unauthorized(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_unverified_members_can_browse_but_cannot_reserve_until_their_signed_link_is_used(): void
    {
        Queue::fake();
        $user = User::factory()->unverified()->create([
            'account_status' => AccountStatus::ACTIVE,
        ]);

        $task = Task::create([
            'title' => 'Email verification task', 'slug' => 'email-verification-task', 'description' => 'A test task.',
            'category' => 'testing', 'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => '10.00', 'incentive_amount' => '2.00', 'expected_payout' => '12.00',
            'available_slots' => 1, 'instructions' => [], 'proof_requirements' => [], 'status' => 'available',
            'starts_at' => now()->subMinute(), 'expires_at' => now()->addDay(), 'created_by' => $user->id,
        ]);

        $this->actingAs($user, 'sanctum')->getJson('/api/me')->assertOk()->assertJsonPath('data.email_verified', false);
        $this->actingAs($user, 'sanctum')->getJson('/api/dashboard')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/tasks')->assertOk();
        $this->actingAs($user, 'sanctum')->postJson('/api/tasks/'.$task->id.'/reserve')->assertUnprocessable()->assertJsonValidationErrors('eligibility');
        $this->actingAs($user, 'sanctum')->postJson('/api/email/verify')->assertAccepted();
        Queue::assertPushed(SendNotificationEmailJob::class);

        $this->assertNull($user->fresh()->email_verified_at);

        $url = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);
        $this->get($url)->assertRedirectContains('email_verified=1');

        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->actingAs($user->fresh(), 'sanctum')->getJson('/api/dashboard')->assertOk();
        $this->assertDatabaseHas('notification_outbox', ['user_id' => $user->id, 'event_key' => 'welcome.'.$user->id]);
    }

    public function test_invalid_and_expired_verification_links_do_not_verify_a_member(): void
    {
        $user = User::factory()->unverified()->create();
        $parameters = ['id' => $user->id, 'hash' => sha1($user->email)];
        $validUrl = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), $parameters);
        $invalidUrl = $validUrl.'&tampered=1';
        $expiredUrl = URL::temporarySignedRoute('verification.verify', now()->subMinute(), $parameters);

        $this->get($invalidUrl)->assertForbidden();
        $this->get($expiredUrl)->assertForbidden();

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_verification_email_resend_is_rate_limited(): void
    {
        Queue::fake();
        $user = User::factory()->unverified()->create();

        for ($attempt = 0; $attempt < 6; $attempt++) {
            $this->actingAs($user, 'sanctum')->postJson('/api/email/verify')->assertAccepted();
        }

        $this->actingAs($user, 'sanctum')->postJson('/api/email/verify')->assertTooManyRequests();
        Queue::assertPushed(SendNotificationEmailJob::class, 6);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_members_cannot_access_admin_routes(): void
    {
        $user = User::factory()->create(['role' => UserRole::MEMBER]);

        $this->actingAs($user, 'sanctum')->getJson('/api/admin/dashboard')->assertForbidden();
    }

    public function test_admins_can_access_admin_routes(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/dashboard')->assertOk();
    }

    public function test_logout_revokes_the_current_token(): void
    {
        User::factory()->create([
            'email' => 'admin@clickandearn.test',
            'password' => Hash::make('password'),
            'role' => UserRole::SUPER_ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@clickandearn.test',
            'password' => 'password',
        ]);

        $token = $response->assertOk()->json('data.token');

        $this->withToken($token)->postJson('/api/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }
}
