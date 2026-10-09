<?php

namespace App\Services;

use App\Jobs\SendNotificationEmailJob;
use App\Models\NotificationOutbox;
use App\Models\User;
use App\Notifications\EventNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EventNotificationService
{
    public function notifyOnce(User $recipient, string $eventKey, EventNotification $notification, ?string $demoBatchId = null): void
    {
        $eventKey = trim($eventKey);
        if ($eventKey === '' || strlen($eventKey) > 191) {
            throw new \InvalidArgumentException('Notification event keys must contain 1 to 191 characters.');
        }

        $recipientBatchId = $recipient->getAttribute('demo_batch_id');
        if ($recipientBatchId && $demoBatchId && $recipientBatchId !== $demoBatchId) {
            throw new \InvalidArgumentException('A demo notification cannot cross demo batches.');
        }
        $demoBatchId = $demoBatchId ?: $recipientBatchId;
        $isDemoNotification = filled($demoBatchId);

        $outbox = DB::transaction(function () use ($recipient, $eventKey, $notification, $demoBatchId, $isDemoNotification): NotificationOutbox {
            $payload = array_merge($notification->toDatabase($recipient), ['event_key' => $eventKey]);
            $outbox = NotificationOutbox::query()->firstOrCreate(
                ['user_id' => $recipient->id, 'event_key' => $eventKey],
                [
                    'title' => $notification->title,
                    'body' => $notification->body,
                    'type' => $notification->type,
                    'data' => $payload,
                    'email_status' => $isDemoNotification ? 'suppressed' : 'pending',
                    'demo_batch_id' => $demoBatchId,
                ],
            );

            if ($outbox->wasRecentlyCreated) {
                $databaseNotification = $recipient->notifications()->create([
                    'id' => (string) Str::uuid(),
                    'type' => EventNotification::class,
                    'data' => $payload,
                ]);
                if ($demoBatchId) {
                    $databaseNotification->forceFill(['demo_batch_id' => $demoBatchId])->save();
                }
            }

            return $outbox;
        });

        if (! $isDemoNotification && $outbox->wasRecentlyCreated && $outbox->email_status === 'pending') {
            SendNotificationEmailJob::dispatch($outbox->id)->afterCommit();
        }
    }
}
