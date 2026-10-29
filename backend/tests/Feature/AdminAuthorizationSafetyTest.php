<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthorizationSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_regular_admin_can_manage_member_and_admin_accounts_but_not_super_admin_accounts(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $member = User::factory()->create();
        $otherAdmin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/admin/users/'.$member->id, ['role' => UserRole::ADMIN->value])
            ->assertOk()
            ->assertJsonPath('data.role', UserRole::ADMIN->value);
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/users/'.$otherAdmin->id.'/suspend')
            ->assertOk();
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/users/'.$admin->id.'/suspend')
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => $member->id, 'role' => UserRole::ADMIN->value]);
        $this->assertDatabaseHas('users', ['id' => $otherAdmin->id, 'account_status' => AccountStatus::SUSPENDED->value]);
    }

    public function test_super_admin_can_change_a_member_role_and_the_change_is_audited(): void
    {
        $superAdmin = User::factory()->create([
            'role' => UserRole::SUPER_ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $member = User::factory()->create();

        $this->actingAs($superAdmin, 'sanctum')
            ->patchJson('/api/admin/users/'.$member->id, ['role' => UserRole::ADMIN->value])
            ->assertOk()
            ->assertJsonPath('data.role', UserRole::ADMIN->value);

        $this->assertDatabaseHas('users', ['id' => $member->id, 'role' => UserRole::ADMIN->value]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $superAdmin->id,
            'action' => 'user.updated',
            'subject_type' => User::class,
            'subject_id' => $member->id,
        ]);
    }

    public function test_admin_can_permanently_delete_a_member_after_confirming_their_email(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $member = User::factory()->create(['email' => 'delete-me@example.com']);
        $member->createToken('test-token');
        $member->notifications()->create([
            'id' => (string) str()->uuid(),
            'type' => 'test',
            'data' => ['message' => 'test'],
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/users/'.$member->id.'/force-delete', ['confirmation' => $member->email])
            ->assertOk()
            ->assertJsonPath('data.deleted', true);

        $this->assertDatabaseMissing('users', ['id' => $member->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $member->id]);
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $member->id]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'action' => 'user.force_deleted',
            'subject_type' => User::class,
            'subject_id' => $member->id,
        ]);
    }

    public function test_user_deletion_requires_an_exact_email_confirmation_and_cannot_delete_the_current_admin(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);
        $member = User::factory()->create(['email' => 'delete-me@example.com']);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/users/'.$member->id.'/force-delete', ['confirmation' => 'wrong@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('confirmation');
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/users/'.$admin->id.'/force-delete', ['confirmation' => $admin->email])
            ->assertForbidden();

        $this->assertModelExists($member);
        $this->assertModelExists($admin);
    }

    public function test_admin_notifications_endpoint_is_registered_and_returns_real_empty_data(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('data.items', [])
            ->assertJsonPath('data.summary.pending_email', 0);
    }
}
