<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Jobs\ExpireReservationsJob;
use App\Jobs\ProcessAirwallexWebhookJob;
use App\Jobs\SendNotificationEmailJob;
use App\Models\NotificationOutbox;
use App\Models\WebhookEvent;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new ExpireReservationsJob)
    ->name('expire-reservations')
    ->everyFifteenMinutes()
    ->withoutOverlapping();
Schedule::call(function (): void {
    NotificationOutbox::query()
        ->where(function ($query): void {
            $query->where('email_status', 'pending')
                ->orWhere(function ($stale): void {
                    $stale->where('email_status', 'sending')
                        ->where('email_locked_at', '<=', now()->subMinutes(10));
                });
        })
        ->orderBy('id')
        ->limit(100)
        ->pluck('id')
        ->each(fn (int $id) => SendNotificationEmailJob::dispatch($id)->afterCommit());
})->name('notification-outbox-dispatch')->everyMinute()->withoutOverlapping();
Schedule::call(function (): void {
    WebhookEvent::query()
        ->whereIn('status', ['received', 'pending_match', 'failed'])
        ->orderBy('id')
        ->limit(100)
        ->pluck('id')
        ->each(fn (int $id) => ProcessAirwallexWebhookJob::dispatch($id)->afterCommit());
})->name('airwallex-webhook-retry-dispatch')->everyMinute()->withoutOverlapping();
