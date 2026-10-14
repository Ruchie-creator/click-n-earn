<?php

namespace Tests\Feature;

use App\Jobs\SendNotificationEmailJob;
use App\Models\NotificationOutbox;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
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
}
