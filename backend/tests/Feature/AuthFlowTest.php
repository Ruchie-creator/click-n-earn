<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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

    public function test_email_cannot_be_marked_verified_without_a_verification_flow(): void
    {
        $user = User::factory()->unverified()->create([
            'account_status' => AccountStatus::ACTIVE,
        ]);

        $this->actingAs($user, 'sanctum')->postJson('/api/email/verify')->assertStatus(501);

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
