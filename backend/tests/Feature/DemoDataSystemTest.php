<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\LedgerDirection;
use App\Enums\LedgerStatus;
use App\Enums\LedgerType;
use App\Enums\UserRole;
use App\Models\DemoBatch;
use App\Models\LedgerEntry;
use App\Models\NotificationOutbox;
use App\Models\Payout;
use App\Models\ProofSubmission;
use App\Models\ReceiptVerification;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use App\Services\DemoDataService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
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
            'demo.accounts.member.password' => 'MemberPreview!2026-A',
            'demo.accounts.member_two.password' => 'MemberPreview!2026-B',
            'demo.owner_email' => 'official.admin@example.test',
            'payout.airwallex.environment' => 'sandbox',
            'filesystems.proof_disk' => 'proofs',
        ]);
        $this->previewOwner = User::create([
            'name' => 'Official Administrator',
            'email' => 'official.admin@example.test',
            'password' => 'OfficialAdmin!2026',
            'role' => UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
            'email_verified_at' => now(),
            'referral_code' => 'OFFICIALADMIN',
        ]);
        $this->previewOwner->forceFill(['email_verified_at' => now()])->save();
        Storage::fake('proofs');
    }

    public function test_demo_seed_is_idempotent_and_status_reports_database_records(): void
    {
        $this->assertSame(0, Artisan::call('demo:seed'), Artisan::output());
        $first = app(DemoDataService::class)->status();
        $batchId = DemoBatch::query()->where('slug', 'client-preview')->value('id');
        $sampleTask = Task::query()->where('demo_batch_id', $batchId)->where('demo_key', 'task-ai-writing-tool')->firstOrFail();
        $this->assertSame('/task-images/ai-writing-tool.jpg', $sampleTask->image_path);

        $this->assertSame([
            'users' => 2,
            'tasks' => 8,
            'reservations' => 7,
            'proofs' => 6,
            'payouts' => 3,
            'ledger_entries' => 15,
            'notifications' => $first['counts']['notifications'],
        ], array_intersect_key($first['counts'], array_flip([
            'users', 'tasks', 'reservations', 'proofs', 'payouts', 'ledger_entries', 'notifications',
        ])));
        $this->assertGreaterThan(0, $first['counts']['notifications']);
        $this->assertTrue($first['installed']);
        $this->assertSame(0, NotificationOutbox::query()->where('demo_batch_id', $batchId)->where('email_status', 'sent')->count());
        $this->assertSame($first['counts']['notifications'], NotificationOutbox::query()->where('demo_batch_id', $batchId)->where('email_status', 'suppressed')->count());

        $this->assertSame(0, Artisan::call('demo:seed'), Artisan::output());
        $second = app(DemoDataService::class)->status();

        $sampleTask->forceFill(['image_path' => null])->save();
        $this->assertSame(0, Artisan::call('demo:seed'), Artisan::output());
        $this->assertSame('/task-images/ai-writing-tool.jpg', $sampleTask->fresh()->image_path);

        $this->assertSame($batchId, DemoBatch::query()->where('slug', 'client-preview')->value('id'));
        $this->assertSame($first['counts'], $second['counts']);
        $this->assertSame(1, User::query()->where('demo_batch_id', $batchId)->where('demo_key', 'member')->count());
        $this->assertSame(1, Task::query()->where('demo_batch_id', $batchId)->where('demo_key', 'task-ai-writing-tool')->count());
        $this->assertSame(15, LedgerEntry::query()->where('demo_batch_id', $batchId)->count());
        $this->assertSame(0, Artisan::call('demo:status'));
    }

    public function test_seed_creates_real_workflow_states_sandbox_labelled_payouts_and_private_preview_proofs(): void
    {
        Artisan::call('demo:seed');
        $batchId = DemoBatch::query()->where('slug', 'client-preview')->value('id');

        $reservationStatuses = TaskReservation::query()->where('demo_batch_id', $batchId)->get()->map(fn (TaskReservation $reservation): string => $reservation->status->value)->all();
        $this->assertContains('reserved', $reservationStatuses);
        $this->assertContains('proof_submitted', $reservationStatuses);
        $this->assertContains('under_review', $reservationStatuses);
        $this->assertContains('approved', $reservationStatuses);
        $this->assertContains('processing', $reservationStatuses);
        $this->assertContains('paid', $reservationStatuses);
        $this->assertContains('changes_requested', $reservationStatuses);
        $payoutStatuses = Payout::query()->where('demo_batch_id', $batchId)->get()->map(fn (Payout $payout): string => $payout->status->value)->all();
        $this->assertEqualsCanonicalizing(['approved', 'processing', 'paid'], $payoutStatuses);
        $this->assertSame(6, ReceiptVerification::query()->where('demo_batch_id', $batchId)->count());

        $proof = ProofSubmission::query()->where('demo_batch_id', $batchId)->firstOrFail();
        $this->assertTrue(Storage::disk('proofs')->exists($proof->file_path));
        $this->assertStringStartsWith('%PDF-1.4', Storage::disk('proofs')->get($proof->file_path));
        $this->assertStringContainsString('DEMO', $proof->original_file_name);
        $this->assertSame(2, User::query()->where('demo_batch_id', $batchId)->whereIn('email', [
            'demo.member@clickearn.example',
            'demo.member2@clickearn.example',
        ])->count());
        $this->assertTrue(Payout::query()->where('demo_batch_id', $batchId)->whereNotNull('provider_reference')->where('provider_reference', 'like', 'DEMO-SANDBOX-%')->exists());
    }

    public function test_demo_members_and_the_official_administrator_use_normal_api_routes(): void
    {
        Artisan::call('demo:seed');

        $memberLogin = $this->postJson('/api/auth/login', [
            'email' => 'demo.member@clickearn.example',
            'password' => 'MemberPreview!2026-A',
        ])->assertOk()->assertJsonPath('data.user.role', 'member');
        $memberToken = $memberLogin->json('data.token');
        $this->getJson('/api/dashboard', ['Authorization' => 'Bearer '.$memberToken])->assertOk();
        $this->getJson('/api/tasks', ['Authorization' => 'Bearer '.$memberToken])->assertOk()->assertJsonPath('data.meta.total', 8);
        $this->getJson('/api/reservations', ['Authorization' => 'Bearer '.$memberToken])->assertOk();
        $this->getJson('/api/earnings', ['Authorization' => 'Bearer '.$memberToken])->assertOk();
        $this->getJson('/api/payouts', ['Authorization' => 'Bearer '.$memberToken])->assertOk();
        $this->getJson('/api/notifications', ['Authorization' => 'Bearer '.$memberToken])->assertOk();
        $this->getJson('/api/me', ['Authorization' => 'Bearer '.$memberToken])->assertOk();
        $this->getJson('/api/admin/demo-data', ['Authorization' => 'Bearer '.$memberToken])->assertForbidden();

        $adminLogin = $this->postJson('/api/auth/login', [
            'email' => 'official.admin@example.test',
            'password' => 'OfficialAdmin!2026',
        ])->assertOk()->assertJsonPath('data.user.role', 'admin');
        $adminToken = $adminLogin->json('data.token');
        Auth::forgetGuards();
        $headers = ['Authorization' => 'Bearer '.$adminToken];
        $this->getJson('/api/admin/dashboard', $headers)->assertOk()->assertJsonPath('data.stats.active_tasks', 8);
        $this->getJson('/api/admin/users', $headers)->assertOk();
        $this->getJson('/api/admin/tasks', $headers)->assertOk();
        $this->getJson('/api/admin/submissions', $headers)->assertOk();
        $this->getJson('/api/admin/payouts', $headers)->assertOk();
        $this->getJson('/api/admin/transactions', $headers)->assertOk();
        $this->getJson('/api/admin/demo-data', $headers)->assertOk()->assertJsonPath('data.installed', true);
    }

    public function test_legacy_demo_administrator_cannot_manage_demo_data_or_invalidate_its_own_session(): void
    {
        $batch = DemoBatch::create([
            'id' => (string) Str::uuid(),
            'slug' => 'legacy-admin-preview',
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

        $this->assertDatabaseHas('users', ['id' => $legacyAdmin->id]);
    }

    public function test_official_administrator_session_remains_valid_after_demo_refresh(): void
    {
        $token = $this->previewOwner->createToken('demo-refresh-regression-test')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->postJson('/api/admin/demo-data/refresh', ['confirmation' => 'REFRESH DEMO DATA'], $headers)
            ->assertOk();

        $this->getJson('/api/me', $headers)
            ->assertOk()
            ->assertJsonPath('data.id', $this->previewOwner->id)
            ->assertJsonPath('data.role', UserRole::ADMIN->value);
    }

    public function test_demo_clear_requires_confirmation_and_preserves_unrelated_financial_and_product_records(): void
    {
        Artisan::call('demo:seed');
        $batchId = DemoBatch::query()->where('slug', 'client-preview')->value('id');
        $realUser = User::create([
            'name' => 'Independent Test Member',
            'email' => 'independent.member@example.test',
            'password' => 'IndependentTest!2026',
            'role' => UserRole::MEMBER,
            'account_status' => AccountStatus::ACTIVE,
            'referral_code' => 'INDEPENDENT1',
        ]);
        $realTask = Task::create([
            'title' => 'Independent test task',
            'slug' => 'independent-test-task',
            'description' => 'Unrelated non-demo task.',
            'category' => 'Testing',
            'external_checkout_url' => 'https://example.test/checkout',
            'reimbursement_amount' => '10.00',
            'incentive_amount' => '2.00',
            'expected_payout' => '12.00',
            'available_slots' => 5,
            'reserved_slots' => 0,
            'completed_slots' => 0,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
            'created_by' => $realUser->id,
        ]);
        $realLedger = LedgerEntry::create([
            'user_id' => $realUser->id,
            'type' => LedgerType::ADJUSTMENT,
            'amount' => '4.25',
            'direction' => LedgerDirection::CREDIT,
            'status' => LedgerStatus::PAID,
            'reference' => 'independent-non-demo-ledger',
            'metadata' => ['origin' => 'safety-test'],
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'official.admin@example.test',
            'password' => 'OfficialAdmin!2026',
        ])->assertOk();
        $admin = $this->previewOwner;
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/demo-data/clear')
            ->assertUnprocessable();
        $this->assertSame(2, User::query()->where('demo_batch_id', $batchId)->count());

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/demo-data/clear', ['confirmation' => 'CLEAR DEMO DATA'])
            ->assertOk()
            ->assertJsonPath('data.found', true);

        $this->assertSame(0, User::query()->where('demo_batch_id', $batchId)->count());
        $this->assertSame(0, Task::query()->where('demo_batch_id', $batchId)->count());
        $this->assertSame(0, TaskReservation::query()->where('demo_batch_id', $batchId)->count());
        $this->assertSame(0, LedgerEntry::query()->where('demo_batch_id', $batchId)->count());
        $this->assertDatabaseHas('users', ['id' => $realUser->id, 'email' => 'independent.member@example.test']);
        $this->assertDatabaseHas('tasks', ['id' => $realTask->id, 'slug' => 'independent-test-task']);
        $this->assertDatabaseHas('ledger_entries', ['id' => $realLedger->id, 'reference' => 'independent-non-demo-ledger']);
        $this->assertDatabaseMissing('demo_batches', ['id' => $batchId]);
    }

    public function test_cleanup_stops_without_mutation_when_an_unmarked_task_references_a_demo_member(): void
    {
        Artisan::call('demo:seed');
        $batchId = DemoBatch::query()->where('slug', 'client-preview')->value('id');
        $member = User::query()->where('demo_batch_id', $batchId)->where('demo_key', 'member')->firstOrFail();
        Task::create([
            'title' => 'Unmarked linked task',
            'slug' => 'unmarked-linked-task',
            'description' => 'Must block cleanup rather than be deleted by the user foreign key.',
            'category' => 'Testing',
            'external_checkout_url' => 'https://example.test/unmarked',
            'reimbursement_amount' => '5.00',
            'incentive_amount' => '1.00',
            'expected_payout' => '6.00',
            'available_slots' => 3,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
            'created_by' => $member->id,
        ]);

        try {
            app(DemoDataService::class)->clear();
            $this->fail('Expected cleanup to stop before deleting linked unmarked data.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('stopped before deleting anything', $exception->getMessage());
        }

        $this->assertSame(2, User::query()->where('demo_batch_id', $batchId)->count());
        $this->assertSame(8, Task::query()->where('demo_batch_id', $batchId)->count());
        $this->assertDatabaseHas('tasks', ['slug' => 'unmarked-linked-task']);
    }

    public function test_force_clear_command_removes_only_the_demo_batch_and_synthetic_proof_files(): void
    {
        Artisan::call('demo:seed');
        $batchId = DemoBatch::query()->where('slug', 'client-preview')->value('id');
        $paths = ProofSubmission::query()->where('demo_batch_id', $batchId)->pluck('file_path')->all();
        $this->assertNotEmpty($paths);

        $this->assertSame(0, Artisan::call('demo:clear', ['--force' => true]), Artisan::output());

        $this->assertDatabaseMissing('demo_batches', ['id' => $batchId]);
        $this->assertSame(0, User::query()->where('demo_batch_id', $batchId)->count());
        foreach ($paths as $path) {
            $this->assertFalse(Storage::disk('proofs')->exists($path));
        }
    }

    public function test_demo_mutations_allow_the_local_database_but_refuse_production_targets_and_live_airwallex(): void
    {
        $testDatabase = config('database.connections.pgsql.database');
        $testDatabaseUrl = config('database.connections.pgsql.url');
        $previousEnvironment = $this->app->environment();
        $this->app->instance('env', 'local');
        config([
            'database.default' => 'pgsql',
            'database.connections.pgsql.database' => 'click_and_earn',
            'database.connections.pgsql.url' => null,
            'payout.airwallex.environment' => 'live',
        ]);
        try {
            app(DemoDataService::class)->seed();
            $this->fail('Expected the local database to reach the live Airwallex guard without connecting to it.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('require Airwallex Sandbox', $exception->getMessage());
        } finally {
            $this->app->instance('env', $previousEnvironment);
            config([
                'database.connections.pgsql.database' => $testDatabase,
                'database.connections.pgsql.url' => $testDatabaseUrl,
                'payout.airwallex.environment' => 'sandbox',
            ]);
        }

        config([
            'database.connections.pgsql.database' => 'click_and_earn_production',
            'database.connections.pgsql.url' => null,
        ]);
        try {
            app(DemoDataService::class)->seed();
            $this->fail('Expected the production-named database target to refuse demo operations.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('production database target', $exception->getMessage());
        } finally {
            config([
                'database.connections.pgsql.database' => $testDatabase,
                'database.connections.pgsql.url' => $testDatabaseUrl,
            ]);
        }

        config(['payout.airwallex.environment' => 'live']);
        try {
            app(DemoDataService::class)->seed();
            $this->fail('Expected live Airwallex configuration to refuse demo operations.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('require Airwallex Sandbox', $exception->getMessage());
        }

        config(['payout.airwallex.environment' => 'sandbox']);
        $previousEnvironment = $this->app->environment();
        $this->app->instance('env', 'production');
        try {
            app(DemoDataService::class)->seed();
            $this->fail('Expected production to refuse demo operations.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('disabled in production', $exception->getMessage());
        } finally {
            $this->app->instance('env', $previousEnvironment);
        }
        $this->assertSame(0, DemoBatch::query()->count());
    }
}
