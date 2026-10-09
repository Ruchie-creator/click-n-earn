<?php

namespace App\Jobs;

use App\Models\Payout;
use App\Models\WebhookEvent;
use App\Services\PayoutService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class ProcessAirwallexWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 8;

    public function __construct(public readonly int $webhookEventId)
    {
    }

    public function backoff(): array
    {
        return [5, 15, 60, 180, 600, 1800, 3600];
    }

    public function handle(PayoutService $payouts): void
    {
        try {
            DB::transaction(function () use ($payouts): void {
                $event = WebhookEvent::query()->lockForUpdate()->find($this->webhookEventId);
                if (! $event || $event->status === 'processed') {
                    return;
                }

                $object = data_get($event->payload, 'data.object', []);
                $reference = data_get($object, 'id')
                    ?: data_get($object, 'transfer_id')
                    ?: data_get($event->payload, 'data.transfer_id')
                    ?: data_get($event->payload, 'data.id')
                    ?: data_get($event->payload, 'transfer.id')
                    ?: data_get($event->payload, 'transfer_id')
                    ?: data_get($event->payload, 'id');
                $requestId = data_get($object, 'request_id')
                    ?: data_get($event->payload, 'data.request_id')
                    ?: data_get($event->payload, 'request_id');

                $query = Payout::query()->where('provider', 'airwallex');
                if (filled($reference)) {
                    $query->where(function ($builder) use ($reference): void {
                        $builder->where('provider_reference', $reference)
                            ->orWhere('idempotency_key', $reference);
                    });
                } elseif (filled($requestId)) {
                    $query->where('idempotency_key', $requestId);
                } else {
                    $event->forceFill([
                        'status' => 'pending_match',
                        'error' => 'Webhook does not contain a payout transfer or request reference.',
                    ])->save();

                    return;
                }

                $payout = $query->lockForUpdate()->first();
                if (! $payout && filled($requestId)) {
                    $payout = Payout::query()
                        ->where('provider', 'airwallex')
                        ->where('idempotency_key', $requestId)
                        ->lockForUpdate()
                        ->first();
                }
                if (! $payout) {
                    $event->forceFill([
                        'status' => 'pending_match',
                        'error' => 'No matching Airwallex payout is recorded yet; the event will be retried.',
                    ])->save();

                    return;
                }

                $eventName = strtolower((string) $event->event_name);
                $providerStatus = strtolower((string) (
                    data_get($object, 'status')
                    ?: data_get($event->payload, 'data.status')
                    ?: data_get($event->payload, 'transfer.status')
                    ?: ''
                ));
                $status = match (true) {
                    str_contains($eventName, 'paid'), str_contains($eventName, 'completed'), str_contains($eventName, 'succeeded'),
                    in_array($providerStatus, ['paid', 'completed', 'succeeded'], true) => 'paid',
                    str_contains($eventName, 'failed'), str_contains($eventName, 'cancelled'), str_contains($eventName, 'canceled'),
                    in_array($providerStatus, ['failed', 'cancelled', 'canceled', 'reversed'], true) => 'failed',
                    default => 'processing',
                };

                $payouts->markProviderStatus($payout, $status, filled($reference) ? (string) $reference : null, [
                    'webhook_event_id' => $event->id,
                    'webhook_event_name' => $event->event_name,
                ]);
                $event->forceFill(['status' => 'processed', 'processed_at' => now(), 'error' => null])->save();
            });
        } catch (Throwable $exception) {
            WebhookEvent::query()->whereKey($this->webhookEventId)->where('status', '!=', 'processed')->update([
                'status' => 'failed',
                'error' => $exception::class,
            ]);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        WebhookEvent::query()->whereKey($this->webhookEventId)->where('status', '!=', 'processed')->update([
            'status' => 'failed',
            'error' => $exception ? $exception::class : 'Webhook job exhausted retries.',
        ]);
    }
}
