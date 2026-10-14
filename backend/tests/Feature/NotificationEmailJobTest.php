<?php

namespace Tests\Feature;

use App\Jobs\SendNotificationEmailJob;
use App\Models\DemoBatch;
use App\Models\NotificationOutbox;
use App\Models\User;
use App\Notifications\EventNotification;
use App\Services\EventNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationEmailJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_reserved_documentation_recipient_is_suppressed_without_attempting_smtp(): void
    {
        Mail::fake();
        $user = User::factory()->create(['email' => 'demo.member@clickearn.example']);
        $outbox = NotificationOutbox::create([
            'user_id' => $user->id,
            'event_key' => 'reservation.created.test',
            'title' => 'Reserved reward',
            'body' => 'Demo notification.',
            'type' => 'success',
            'data' => [],
            'email_status' => 'pending',
        ]);

        (new SendNotificationEmailJob($outbox->id))->handle();

        $outbox->refresh();
        $this->assertSame('suppressed', $outbox->email_status);
        $this->assertSame(1, $outbox->email_attempts);
        $this->assertStringContainsString('reserved non-deliverable', $outbox->email_last_error);
        Mail::assertNothingSent();
    }

    public function test_real_recipient_gets_email_for_a_catalog_preview_task(): void
    {
        Queue::fake();
        $batch = $this->catalogBatch();
        $member = User::factory()->create(['email' => 'member@example.net']);

        app(EventNotificationService::class)->notifyOnce(
            $member,
            'reservation.created.catalog-real-member',
            new EventNotification('Your reward has been reserved', 'Your task reservation is active.', 'success'),
            $batch->id,
        );

        $this->assertDatabaseHas('notification_outbox', [
            'user_id' => $member->id,
            'event_key' => 'reservation.created.catalog-real-member',
            'email_status' => 'pending',
            'demo_batch_id' => $batch->id,
        ]);
        Queue::assertPushed(SendNotificationEmailJob::class);
    }

    public function test_demo_recipient_remains_suppressed_even_when_catalog_batch_is_provided(): void
    {
        Queue::fake();
        $batch = $this->catalogBatch();
        $demoMember = User::factory()->create(['email' => 'demo.member@clickearn.example']);
        $demoMember->forceFill(['demo_batch_id' => $batch->id, 'demo_key' => 'member'])->save();

        app(EventNotificationService::class)->notifyOnce(
            $demoMember,
            'reservation.created.catalog-demo-member',
            new EventNotification('Your reward has been reserved', 'Your task reservation is active.', 'success'),
            $batch->id,
        );

        $this->assertDatabaseHas('notification_outbox', [
            'user_id' => $demoMember->id,
            'event_key' => 'reservation.created.catalog-demo-member',
            'email_status' => 'suppressed',
        ]);
        Queue::assertNothingPushed();
    }

    private function catalogBatch(): DemoBatch
    {
        return DemoBatch::query()->create([
            'id' => (string) Str::uuid(),
            'slug' => 'catalog-email-test-'.Str::lower(Str::random(8)),
            'label' => 'Catalog email test',
            'metadata' => ['purpose' => 'catalog_preview'],
        ]);
    }
}
