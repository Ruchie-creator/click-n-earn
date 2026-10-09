<?php

namespace App\Jobs;

use App\Models\NotificationOutbox;
use App\Notifications\EventNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class SendNotificationEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    public function __construct(public readonly int $outboxId)
    {
    }

    public function backoff(): array
    {
        return [30, 120, 600, 1800];
    }

    public function handle(): void
    {
        $outbox = DB::transaction(function (): ?NotificationOutbox {
            $row = NotificationOutbox::query()->lockForUpdate()->find($this->outboxId);
            if (! $row || $row->email_status === 'sent') {
                return null;
            }
            if ($row->email_status === 'sending' && $row->email_locked_at?->greaterThan(now()->subMinutes(10))) {
                return null;
            }

            $row->forceFill([
                'email_status' => 'sending',
                'email_attempts' => $row->email_attempts + 1,
                'email_locked_at' => now(),
                'email_last_error' => null,
            ])->save();

            return $row->load('user');
        });

        if (! $outbox || ! $outbox->user || blank($outbox->user->email)) {
            return;
        }

        try {
            $outbox->user->notifyNow(new EventNotification(
                $outbox->title,
                $outbox->body,
                $outbox->type,
                $outbox->data ?: [],
            ));
            $outbox->forceFill([
                'email_status' => 'sent',
                'email_sent_at' => now(),
                'email_locked_at' => null,
                'email_last_error' => null,
            ])->save();
        } catch (Throwable $exception) {
            NotificationOutbox::query()->whereKey($outbox->id)->where('email_status', 'sending')->update([
                'email_status' => 'pending',
                'email_locked_at' => null,
                'email_last_error' => $exception::class,
            ]);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        NotificationOutbox::query()->whereKey($this->outboxId)->whereIn('email_status', ['pending', 'sending'])->update([
            'email_status' => 'failed',
            'email_locked_at' => null,
            'email_last_error' => $exception ? $exception::class : 'Email delivery failed after retries.',
        ]);
    }
}
