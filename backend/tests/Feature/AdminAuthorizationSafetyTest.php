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

    public function test_regular_admin_cannot_change_roles_or_manage_admin_accounts(): void
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
            ->assertForbidden();
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/users/'.$otherAdmin->id.'/suspend')
            ->assertForbidden();
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/users/'.$admin->id.'/suspend')
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => $member->id, 'role' => UserRole::MEMBER->value]);
        $this->assertDatabaseHas('users', ['id' => $otherAdmin->id, 'account_status' => AccountStatus::ACTIVE->value]);
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
