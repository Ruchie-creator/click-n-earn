<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\DemoBatch;
use App\Models\Payout;
use App\Models\ProofSubmission;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use App\Services\DemoDataService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class DemoDataSystemTest extends TestCase
{
    use RefreshDatabase;

    private User $previewOwner;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'demo.enabled' => true,
            'demo.client_preview' => true,
            'demo.owner_email' => 'official.admin@example.test',
            'payout.airwallex.environment' => 'sandbox',
        ]);
        $this->previewOwner = User::create([
            'name' => 'Official Administrator',
            'email' => 'official.admin@example.test',
            'password' => 'OfficialAdmin!2026',
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
            'referral_code' => 'OFFICIALADMIN',
        ]);
        $this->previewOwner->forceFill(['email_verified_at' => now()])->save();
    }

    public function test_demo_seed_creates_only_catalog_tasks_and_is_idempotent(): void
    {
        $this->assertSame(0, Artisan::call('demo:seed'), Artisan::output());
        $status = app(DemoDataService::class)->status();
        $batch = DemoBatch::query()->where('slug', 'client-preview')->firstOrFail();

        $this->assertSame(0, $status['counts']['users']);
        $this->assertSame(8, $status['counts']['tasks']);
        $this->assertSame(0, $status['counts']['reservations']);
        $this->assertSame(0, $status['counts']['proofs']);
        $this->assertSame(0, $status['counts']['payouts']);
        $this->assertSame(0, $status['counts']['ledger_entries']);
        $this->assertSame(0, $status['counts']['notifications']);
        $this->assertSame(0, User::query()->where('demo_batch_id', $batch->id)->count());
        $this->assertSame(8, Task::query()->where('demo_batch_id', $batch->id)->where('created_by', $this->previewOwner->id)->count());
        $this->assertSame(0, TaskReservation::query()->where('demo_batch_id', $batch->id)->count());
        $this->assertSame(0, ProofSubmission::query()->where('demo_batch_id', $batch->id)->count());
        $this->assertSame(0, Payout::query()->where('demo_batch_id', $batch->id)->count());

        $this->assertSame(0, Artisan::call('demo:seed'), Artisan::output());
        $this->assertSame(8, Task::query()->where('demo_batch_id', $batch->id)->count());
    }

    public function test_refresh_replaces_only_the_catalog_batch_and_preserves_the_official_administrator(): void
    {
        Artisan::call('demo:seed');
        $token = $this->previewOwner->createToken('demo-refresh-regression-test')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->postJson('/api/admin/demo-data/refresh', ['confirmation' => 'REFRESH DEMO DATA'], $headers)
            ->assertOk();

        $this->getJson('/api/me', $headers)
            ->assertOk()
            ->assertJsonPath('data.id', $this->previewOwner->id);
        $this->assertDatabaseHas('users', ['id' => $this->previewOwner->id, 'demo_batch_id' => null]);
        $this->assertSame(8, Task::query()->whereNotNull('demo_batch_id')->count());
    }

    public function test_legacy_demo_administrator_cannot_manage_or_be_deleted_by_demo_data_tools(): void
    {
        $batch = DemoBatch::create([
            'id' => (string) Str::uuid(),
            'slug' => config('demo.batch_slug'),
            'label' => 'Legacy preview',
            'metadata' => ['synthetic' => true],
        ]);
        $legacyAdmin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'demo_batch_id' => $batch->id,
            'demo_key' => 'administrator',
        ]);

        $this->actingAs($legacyAdmin, 'sanctum')
            ->postJson('/api/admin/demo-data/refresh', ['confirmation' => 'REFRESH DEMO DATA'])
            ->assertForbidden();

        try {
            app(DemoDataService::class)->clear();
            $this->fail('Expected legacy administrator cleanup to be blocked.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('administrator '.$legacyAdmin->email.' is still tagged as demo data', $exception->getMessage());
        }

        $this->assertDatabaseHas('users', ['id' => $legacyAdmin->id]);
        $this->assertDatabaseHas('demo_batches', ['id' => $batch->id]);
    }

    public function test_demo_mutations_refuse_production_database_targets_and_live_airwallex(): void
    {
        config(['payout.airwallex.environment' => 'live']);
        try {
            app(DemoDataService::class)->seed();
            $this->fail('Expected live Airwallex configuration to be rejected.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('require Airwallex Sandbox', $exception->getMessage());
        }

        config([
            'payout.airwallex.environment' => 'sandbox',
            'database.connections.pgsql.database' => 'click_and_earn_production',
        ]);
        try {
            app(DemoDataService::class)->seed();
            $this->fail('Expected production database target to be rejected.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('production database target', $exception->getMessage());
        }
    }
}
