<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfilePhotoUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_member_can_upload_and_replace_their_own_profile_photo(): void
    {
        Storage::fake('public');
        $member = User::factory()->create(['account_status' => AccountStatus::ACTIVE]);
        $previousPath = 'avatars/'.$member->id.'/previous.png';
        Storage::disk('public')->put($previousPath, 'old profile photo');
        $member->forceFill(['avatar_path' => $previousPath])->save();

        $response = $this->actingAs($member, 'sanctum')->postJson('/api/profile/photo', [
            'avatar' => UploadedFile::fake()->image('profile.png')->size(320),
            'user_id' => User::factory()->create()->id,
        ])->assertOk()->assertJsonPath('data.id', $member->id);

        $updatedMember = $member->fresh();
        $this->assertNotSame($previousPath, $updatedMember->avatar_path);
        $this->assertStringStartsWith('avatars/'.$member->id.'/', $updatedMember->avatar_path);
        Storage::disk('public')->assertExists($updatedMember->avatar_path);
        Storage::disk('public')->assertMissing($previousPath);
        $response->assertJsonPath('data.avatar_url', Storage::disk('public')->url($updatedMember->avatar_path));
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $member->id,
            'action' => 'profile.photo_updated',
            'subject_id' => $member->id,
        ]);
    }

    public function test_an_admin_can_upload_a_photo_to_their_own_account(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
        ]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/profile/photo', [
            'avatar' => UploadedFile::fake()->image('admin.png'),
        ])->assertOk()->assertJsonPath('data.id', $admin->id);

        Storage::disk('public')->assertExists($admin->fresh()->avatar_path);
    }

    public function test_profile_photo_upload_requires_authentication(): void
    {
        $this->postJson('/api/profile/photo', [
            'avatar' => UploadedFile::fake()->image('profile.png'),
        ])->assertUnauthorized();
    }

    public function test_profile_photo_upload_rejects_unsupported_content_and_oversized_images(): void
    {
        $member = User::factory()->create();
        Storage::fake('public');

        $this->actingAs($member, 'sanctum')->postJson('/api/profile/photo', [
            'avatar' => UploadedFile::fake()->create('profile.svg', 1, 'image/svg+xml'),
        ])->assertUnprocessable()->assertJsonValidationErrors('avatar');

        $this->actingAs($member, 'sanctum')->postJson('/api/profile/photo', [
            'avatar' => UploadedFile::fake()->image('large.png')->size(5121),
        ])->assertUnprocessable()->assertJsonValidationErrors('avatar');

        Storage::disk('public')->assertDirectoryEmpty('avatars/'.$member->id);
    }
}
