<?php

namespace App\Services;

use App\Enums\LedgerStatus;
use App\Enums\PayoutStatus;
use App\Enums\ReservationStatus;
use App\Models\Payout;
use App\Models\PayoutMethod;
use App\Models\TaskReservation;
use App\Models\User;
use App\Notifications\EventNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Enums\UserRole;
use App\Jobs\ProcessPayoutJob;

class PayoutService
{
    public function __construct(
        private readonly PayoutProviderInterface $provider,
        private readonly StatusTransitionService $transitions,
        private readonly LedgerService $ledger,
        private readonly AuditLogService $audit,
        private readonly ReservationCapacityService $capacity,
        private readonly EventNotificationService $notifications,
    ) {
    }

    public function createApprovedForReservation(TaskReservation $reservation): Payout
    {
        return DB::transaction(function () use ($reservation): Payout {
            $reservation->loadMissing('user');
            $method = $reservation->user->payoutMethods()->where('status', 'active')->where('is_default', true)->first()
                ?: $reservation->user->payoutMethods()->where('status', 'active')->latest()->first();

            $payout = Payout::firstOrCreate(
                ['idempotency_key' => 'reservation-'.$reservation->id],
                [
                    'user_id' => $reservation->user_id,
                    'task_reservation_id' => $reservation->id,
                    'payout_method_id' => $method?->id,
                    'provider' => config('payout.driver', 'fake'),
                    'amount' => $reservation->expected_payout,
                    'currency' => config('payout.currency', 'USD'),
                    'status' => PayoutStatus::APPROVED,
                    'requested_at' => now(),
                ],
            );
            if ($batchId = $reservation->getAttribute('demo_batch_id')) {
                $payout->forceFill([
                    'demo_batch_id' => $batchId,
                    'demo_key' => 'payout-reservation-'.$reservation->id,
                ])->save();
            }
            $this->ledger->updateReservationStatus($reservation, LedgerStatus::PENDING);
            $reservation->ledgerEntries()->update(['payout_id' => $payout->id]);

            return $payout->fresh(['reservation', 'payoutMethod']);
        });
    }

    public function process(int|Payout $payout): Payout
    {
        return DB::transaction(function () use ($payout): Payout {
            $model = Payout::query()->lockForUpdate()->with(['reservation', 'user', 'payoutMethod'])->findOrFail(
                $payout instanceof Payout ? $payout->id : $payout,
            );

            if ($model->status !== PayoutStatus::APPROVED) {
                return $model;
            }

            $method = $model->payoutMethod?->status === 'active'
                ? $model->payoutMethod
                : ($model->user->payoutMethods()->where('status', 'active')->where('is_default', true)->first()
                    ?: $model->user->payoutMethods()->where('status', 'active')->latest()->first());
            if (! $method) {
                return $this->markFailedLocked($model, 'Add an active payout method before processing this payout.');
            }

            try {
                $result = $this->provider->submit($model, $method);
            } catch (\Throwable $exception) {
                \Illuminate\Support\Facades\Log::warning('Payout provider submission failed.', [
                    'payout_id' => $model->id,
                    'exception' => $exception::class,
                ]);

                return $this->markFailedLocked($model, 'The payout provider could not accept this payout. It is available for manual retry.', [
                    'exception' => $exception::class,
                ]);
            }

            $model->forceFill([
                'provider_reference' => $result->reference ?: $model->provider_reference,
                'metadata' => array_merge($model->metadata ?: [], [
                    'last_provider_status' => $result->status,
                    'last_provider_update_at' => now()->toISOString(),
                ]),
            ])->save();

            if ($result->isPaid()) {
                return $this->markPaidLocked($model, $result->reference, 'Provider confirmed payment.');
            }
            if ($result->isFailed()) {
                return $this->markFailedLocked($model, $result->message ?: 'Provider rejected the payout.');
            }

            return $this->markProcessingLocked($model, 'Provider accepted the payout for processing.');
        });
    }

    public function sync(int|Payout $payout): Payout
    {
        return DB::transaction(function () use ($payout): Payout {
            $model = Payout::query()->lockForUpdate()->with(['reservation', 'user'])->findOrFail(
                $payout instanceof Payout ? $payout->id : $payout,
            );
            if (! in_array($model->status, [PayoutStatus::PROCESSING, PayoutStatus::APPROVED], true)) {
                return $model;
            }

            try {
                $result = $this->provider->retrieve($model);
            } catch (\Throwable $exception) {
                \Illuminate\Support\Facades\Log::warning('Payout provider status sync failed.', [
                    'payout_id' => $model->id,
                    'exception' => $exception::class,
                ]);

                return $model;
            }

            $model->forceFill([
                'provider_reference' => $result->reference ?: $model->provider_reference,
                'metadata' => array_merge($model->metadata ?: [], [
                    'last_provider_status' => $result->status,
                    'last_provider_sync_at' => now()->toISOString(),
                ]),
            ])->save();

            return match (true) {
                $result->isPaid() => $this->markPaidLocked($model, $result->reference, 'Provider webhook/status sync confirmed payment.'),
                $result->isFailed() => $this->markFailedLocked($model, $result->message ?: 'Provider reported a failed payout.'),
                default => $this->markProcessingLocked($model, 'Provider status remains processing.'),
            };
        });
    }

    public function markProviderStatus(Payout $payout, string $status, ?string $reference = null, array $metadata = []): Payout
    {
        return DB::transaction(function () use ($payout, $status, $reference, $metadata): Payout {
            $model = Payout::query()->lockForUpdate()->with(['reservation', 'user'])->findOrFail($payout->id);
            $model->forceFill([
                'provider_reference' => $reference ?: $model->provider_reference,
                'metadata' => array_merge($model->metadata ?: [], $metadata),
            ])->save();

            return match ($status) {
                'paid' => $this->markPaidLocked($model, $reference, 'Airwallex webhook confirmed payment.'),
                'failed', 'cancelled' => $model->status === PayoutStatus::PAID
                    ? $this->markReversedLocked($model, 'Airwallex reported a post-payment failure.')
                    : $this->markFailedLocked($model, 'Airwallex webhook reported a failed or cancelled payout.'),
                default => $this->markProcessingLocked($model, 'Airwallex webhook reported processing.'),
            };
        });
    }

    public function manualMarkPaid(Payout $payout, string $reference, ?string $note, ?int $actorId = null): Payout
    {
        if (blank(trim($reference))) {
            throw ValidationException::withMessages(['reference' => 'A manual payout reference is required.']);
        }

        return DB::transaction(function () use ($payout, $reference, $note, $actorId): Payout {
            $model = Payout::query()->lockForUpdate()->with(['reservation', 'user'])->findOrFail($payout->id);
            if ($model->status === PayoutStatus::PAID) {
                return $model;
            }
            if (in_array($model->status, [PayoutStatus::CANCELLED, PayoutStatus::REVERSED], true)) {
                throw ValidationException::withMessages(['status' => 'A cancelled or reversed payout cannot be marked paid.']);
            }
            $model->forceFill([
                'manual_reference' => $reference,
                'manual_note' => $note,
                'provider' => 'manual',
            ])->save();

            $result = $this->markPaidLocked($model, $reference, 'Marked paid manually by an administrator.');
            $this->audit->record('payout.manual_paid', $result, actorId: $actorId, after: $result->toArray(), reason: $note);

            return $result;
        });
    }

    public function retryFailed(Payout $payout, ?int $actorId = null): Payout
    {
        return DB::transaction(function () use ($payout, $actorId): Payout {
            $model = Payout::query()->lockForUpdate()->with(['reservation', 'user', 'payoutMethod'])->findOrFail($payout->id);
            if ($model->status === PayoutStatus::APPROVED) {
                if (! $model->getAttribute('demo_batch_id')) {
                    ProcessPayoutJob::dispatch($model->id)->afterCommit();
                }

                return $model;
            }
            if ($model->status !== PayoutStatus::FAILED) {
                throw ValidationException::withMessages(['status' => 'Only failed payouts can be retried.']);
            }

            $before = $model->toArray();
            $model->forceFill([
                'status' => PayoutStatus::APPROVED,
                'failed_at' => null,
                'failure_reason' => null,
                'processing_at' => null,
            ])->save();

            if ($model->task_reservation_id) {
                $reservation = $model->reservation()->lockForUpdate()->firstOrFail();
                if ($reservation->status === ReservationStatus::PAYOUT_FAILED) {
                    $this->transitions->transition($reservation, ReservationStatus::APPROVED->value, $actorId, 'Payout retry requested.');
                } elseif (! in_array($reservation->status, [ReservationStatus::APPROVED, ReservationStatus::PROCESSING], true)) {
                    throw ValidationException::withMessages(['status' => 'The reservation is not eligible for payout retry.']);
                }
                $this->ledger->updateReservationStatus($reservation, LedgerStatus::PENDING);
            }

            $this->audit->record('payout.retry_requested', $model, actorId: $actorId, before: $before, after: $model->toArray());
            if (! $model->getAttribute('demo_batch_id')) {
                ProcessPayoutJob::dispatch($model->id)->afterCommit();
            }

            return $model->fresh(['reservation', 'user', 'payoutMethod']);
        });
    }

    private function markProcessingLocked(Payout $payout, string $message): Payout
    {
        $changed = $payout->status !== PayoutStatus::PROCESSING;
        if ($changed) {
            $payout->forceFill([
                'status' => PayoutStatus::PROCESSING,
                'processing_at' => $payout->processing_at ?: now(),
                'failed_at' => null,
                'failure_reason' => null,
            ])->save();
        }
        if ($payout->reservation && $payout->reservation->status === ReservationStatus::APPROVED) {
            $this->transitions->transition($payout->reservation, ReservationStatus::PROCESSING->value, reason: $message);
        } elseif ($payout->reservation && $payout->reservation->status === ReservationStatus::PAYOUT_FAILED) {
            $this->transitions->transition($payout->reservation, ReservationStatus::PROCESSING->value, reason: $message);
        }
        if ($payout->reservation) {
            $this->ledger->updateReservationStatus($payout->reservation, LedgerStatus::PROCESSING);
        }
        if ($changed && $payout->user) {
            $this->notifications->notifyOnce($payout->user, 'payout.processing.'.$payout->id.'.'.($payout->processing_at?->getTimestamp() ?? now()->getTimestamp()), new EventNotification(
                'Your payout is processing',
                sprintf('Your %s %s payout has been sent for processing.', $payout->amount, $payout->currency),
                'processing',
                ['payout_id' => $payout->id],
            ), $payout->getAttribute('demo_batch_id'));
        }

        return $payout->fresh(['reservation', 'user', 'payoutMethod']);
    }

    private function markPaidLocked(Payout $payout, ?string $reference, string $message): Payout
    {
        if ($payout->status === PayoutStatus::PAID) {
            return $payout->fresh(['reservation', 'user', 'payoutMethod']);
        }
        if (in_array($payout->status, [PayoutStatus::CANCELLED, PayoutStatus::REVERSED], true)) {
            return $payout->fresh(['reservation', 'user', 'payoutMethod']);
        }
        $reservationWasAlreadyPaid = $payout->reservation?->status === ReservationStatus::PAID;
        if ($payout->reservation && ! in_array($payout->reservation->status, [
            ReservationStatus::APPROVED,
            ReservationStatus::PROCESSING,
            ReservationStatus::PAYOUT_FAILED,
            ReservationStatus::PAID,
        ], true)) {
            throw ValidationException::withMessages(['status' => 'The reservation is not eligible to be marked paid.']);
        }
        if ($payout->reservation && $payout->reservation->status === ReservationStatus::APPROVED) {
            $this->transitions->transition($payout->reservation, ReservationStatus::PROCESSING->value, reason: 'Payout payment confirmed.');
        } elseif ($payout->reservation && $payout->reservation->status === ReservationStatus::PAYOUT_FAILED) {
            $this->transitions->transition($payout->reservation, ReservationStatus::PROCESSING->value, reason: 'Provider confirmed the payout after a failed status.');
        }
        if ($payout->reservation && $payout->reservation->status === ReservationStatus::PROCESSING) {
            $this->transitions->transition($payout->reservation, ReservationStatus::PAID->value, reason: $message);
        }

        $payout->forceFill([
            'status' => PayoutStatus::PAID,
            'provider_reference' => $reference ?: $payout->provider_reference,
            'paid_at' => now(),
            'processing_at' => $payout->processing_at ?: now(),
        ])->save();
        if ($payout->reservation) {
            $this->ledger->updateReservationStatus($payout->reservation, LedgerStatus::PAID);
            if (! $reservationWasAlreadyPaid) {
                $this->capacity->release($payout->reservation, complete: true);
                $payout->reservation->forceFill(['completed_at' => now()])->save();
            }
        }
        if ($payout->referral_id) {
            $payout->ledgerEntries()->update(['status' => LedgerStatus::PAID->value]);
            $payout->referral()->update(['reward_status' => 'paid']);
        }
        if ($payout->user) {
            $this->notifications->notifyOnce($payout->user, 'payout.paid.'.$payout->id, new EventNotification(
            'Payout paid',
            sprintf('Your %s %s payout has been marked paid.', $payout->amount, $payout->currency),
            'success',
            ['payout_id' => $payout->id, 'reference' => $reference],
            ), $payout->getAttribute('demo_batch_id'));
        }

        return $payout->fresh(['reservation', 'user', 'payoutMethod']);
    }

    private function markFailedLocked(Payout $payout, string $reason, array $metadata = []): Payout
    {
        if (in_array($payout->status, [PayoutStatus::FAILED, PayoutStatus::PAID, PayoutStatus::REVERSED, PayoutStatus::CANCELLED], true)) {
            return $payout->fresh(['reservation', 'user', 'payoutMethod']);
        }

        $payout->forceFill([
            'status' => PayoutStatus::FAILED,
            'failed_at' => now(),
            'failure_reason' => $reason,
            'metadata' => array_merge($payout->metadata ?: [], $metadata),
        ])->save();
        $reservation = $payout->reservation;
        if ($reservation && in_array($reservation->status, [ReservationStatus::APPROVED, ReservationStatus::PROCESSING], true)) {
            $this->transitions->transition($reservation, ReservationStatus::PAYOUT_FAILED->value, reason: $reason);
            $this->ledger->updateReservationStatus($reservation, LedgerStatus::FAILED);
        }
        $failureEventKey = 'payout.failed.'.$payout->id.'.'.($payout->failed_at?->getTimestamp() ?? now()->getTimestamp());
        if ($payout->user) {
            $this->notifications->notifyOnce($payout->user, $failureEventKey, new EventNotification(
            'Payout needs attention',
            $reason,
            'error',
            ['payout_id' => $payout->id],
            ), $payout->getAttribute('demo_batch_id'));
        }
        User::query()->whereIn('role', [UserRole::ADMIN->value, UserRole::SUPER_ADMIN->value])->get()->each(
            fn (User $admin) => $this->notifications->notifyOnce($admin, $failureEventKey.'.admin.'.$admin->id, new EventNotification(
                'Payout failed',
                sprintf('Payout #%d needs attention: %s', $payout->id, $reason),
                'error',
                ['payout_id' => $payout->id],
            ), $payout->getAttribute('demo_batch_id')),
        );

        return $payout->fresh(['reservation', 'user', 'payoutMethod']);
    }

    private function markReversedLocked(Payout $payout, string $reason): Payout
    {
        if ($payout->status === PayoutStatus::REVERSED) {
            return $payout->fresh(['reservation', 'user', 'payoutMethod']);
        }
        $payout->forceFill([
            'status' => PayoutStatus::REVERSED,
            'failed_at' => now(),
            'failure_reason' => $reason,
        ])->save();
        if ($payout->reservation && $payout->reservation->status === ReservationStatus::PAID) {
            $this->transitions->transition($payout->reservation, ReservationStatus::REVERSED->value, reason: $reason);
            $this->ledger->updateReservationStatus($payout->reservation, LedgerStatus::REVERSED);
        }
        if ($payout->user) {
            $this->notifications->notifyOnce($payout->user, 'payout.reversed.'.$payout->id, new EventNotification(
            'Payout reversed',
            $reason,
            'error',
            ['payout_id' => $payout->id],
            ), $payout->getAttribute('demo_batch_id'));
        }

        return $payout->fresh(['reservation', 'user', 'payoutMethod']);
    }
}
