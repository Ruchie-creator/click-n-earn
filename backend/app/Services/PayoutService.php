<?php

namespace App\Services;

use App\Enums\LedgerStatus;
use App\Enums\PayoutStatus;
use App\Enums\ReservationStatus;
use App\Enums\UserRole;
use App\Exceptions\AirwallexReconciliationRequired;
use App\Models\Payout;
use App\Models\TaskReservation;
use App\Models\User;
use App\Notifications\EventNotification;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PayoutService
{
    public function __construct(
        private readonly PayoutProviderInterface $provider,
        private readonly StatusTransitionService $transitions,
        private readonly LedgerService $ledger,
        private readonly AuditLogService $audit,
        private readonly ReservationCapacityService $capacity,
        private readonly EventNotificationService $notifications,
        private readonly AirwallexEnvironment $environments,
    ) {}

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
                    'provider' => 'airwallex',
                    'provider_environment' => $this->environments->active(),
                    'amount' => $reservation->expected_payout,
                    'currency' => config('payout.currency', 'USD'),
                    'status' => PayoutStatus::APPROVED,
                    'requested_at' => now(),
                    'provider_request_id' => 'click-earn-'.$this->environments->active().'-reservation-'.$reservation->id,
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
            if ($model->getAttribute('demo_batch_id') && $model->provider_environment === 'live') {
                throw ValidationException::withMessages(['status' => 'Demo payouts cannot be released in Live Airwallex mode.']);
            }

            $method = $model->payoutMethod?->status === 'active'
                ? $model->payoutMethod
                : ($model->user->payoutMethods()->where('status', 'active')->where('is_default', true)->first()
                    ?: $model->user->payoutMethods()->where('status', 'active')->latest()->first());
            if (! $method) {
                Log::info('Payout release deferred because no active payout method is available.', ['payout_id' => $model->id]);

                return $model;
            }

            try {
                $result = $this->provider->submit($model, $method);
            } catch (AirwallexReconciliationRequired $exception) {
                Log::warning('Payout provider result is ambiguous.', ['payout_id' => $model->id, 'exception' => $exception::class]);

                return $this->markReconciliationRequiredLocked($model, 'Airwallex did not confirm whether this transfer was created. Reconcile before retrying.');
            } catch (\Throwable $exception) {
                $failureContext = $this->safeProviderFailureContext($exception);
                Log::warning('Payout provider submission failed.', [
                    'payout_id' => $model->id,
                    'exception' => $exception::class,
                    ...$failureContext,
                ]);

                return $this->markFailedLocked($model, $this->payoutFailureReason($failureContext), [
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
            if (! in_array($model->status, [PayoutStatus::PROCESSING, PayoutStatus::SENT, PayoutStatus::APPROVED, PayoutStatus::RECONCILIATION_REQUIRED], true)) {
                return $model;
            }

            try {
                $result = $this->provider->retrieve($model);
            } catch (AirwallexReconciliationRequired $exception) {
                return $this->markReconciliationRequiredLocked($model, 'The provider response is still ambiguous. Reconcile with Airwallex before retrying.');
            } catch (\Throwable $exception) {
                Log::warning('Payout provider status sync failed.', [
                    'payout_id' => $model->id,
                    'exception' => $exception::class,
                    ...$this->safeProviderFailureContext($exception),
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
                $result->status === 'sent' => $this->markSentLocked($model, 'Provider confirmed the payout has been sent.'),
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
                'sent' => $this->markSentLocked($model, 'Airwallex webhook confirmed the transfer was sent.'),
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
                return $model;
            }
            if ($model->status === PayoutStatus::RECONCILIATION_REQUIRED) {
                throw ValidationException::withMessages(['status' => 'Reconcile with Airwallex before retrying this payout.']);
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
                ['payout_id' => $payout->id, 'amount' => $payout->amount, 'currency' => $payout->currency, 'reference' => $payout->provider_reference ?: 'Pending confirmation', 'masked_account' => $payout->payoutMethod?->maskedAccount()],
            ), $payout->getAttribute('demo_batch_id'));
        }

        return $payout->fresh(['reservation', 'user', 'payoutMethod']);
    }

    private function markSentLocked(Payout $payout, string $message): Payout
    {
        $changed = $payout->status !== PayoutStatus::SENT;
        $payout->forceFill([
            'status' => PayoutStatus::SENT,
            'processing_at' => $payout->processing_at ?: now(),
            'failure_reason' => null,
        ])->save();
        if ($payout->reservation && $payout->reservation->status === ReservationStatus::APPROVED) {
            $this->transitions->transition($payout->reservation, ReservationStatus::PROCESSING->value, reason: $message);
            $this->ledger->updateReservationStatus($payout->reservation, LedgerStatus::PROCESSING);
        }
        if ($changed && $payout->user) {
            $this->notifications->notifyOnce($payout->user, 'payout.sent.'.$payout->id, new EventNotification(
                'Your payout has been sent',
                'Your bank transfer has been sent and is awaiting final confirmation.',
                'processing',
                ['payout_id' => $payout->id, 'amount' => $payout->amount, 'currency' => $payout->currency, 'reference' => $payout->provider_reference ?: 'Pending confirmation', 'masked_account' => $payout->payoutMethod?->maskedAccount()],
            ), $payout->getAttribute('demo_batch_id'));
        }

        return $payout->fresh(['reservation', 'user', 'payoutMethod']);
    }

    private function markReconciliationRequiredLocked(Payout $payout, string $reason): Payout
    {
        $payout->forceFill([
            'status' => PayoutStatus::RECONCILIATION_REQUIRED,
            'failure_reason' => $reason,
            'metadata' => array_merge($payout->metadata ?: [], ['reconciliation_required_at' => now()->toISOString()]),
        ])->save();

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
                ['payout_id' => $payout->id, 'amount' => $payout->amount, 'currency' => $payout->currency, 'reference' => $payout->provider_reference ?: $reference, 'masked_account' => $payout->payoutMethod?->maskedAccount(), 'completed_at' => $payout->paid_at?->format('M j, Y g:i A')],
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
        $failureEventKey = 'payout.failed.'.$payout->id.'.'.hash('sha256', mb_strtolower(trim($reason)));
        if ($payout->user) {
            $this->notifications->notifyOnce($payout->user, $failureEventKey, new EventNotification(
                'Payout needs attention',
                $reason,
                'error',
                [
                    'payout_id' => $payout->id,
                    'amount' => $payout->amount,
                    'currency' => $payout->currency,
                    'reference' => $payout->provider_reference ?: 'Unavailable',
                    'masked_account' => $payout->payoutMethod?->maskedAccount(),
                    'reason' => $reason,
                ],
            ), $payout->getAttribute('demo_batch_id'));
        }
        User::query()->whereIn('role', [UserRole::ADMIN->value, UserRole::SUPER_ADMIN->value])->get()->each(
            fn (User $admin) => $this->notifications->notifyOnce($admin, $failureEventKey.'.admin.'.$admin->id, new EventNotification(
                'Payout failed',
                sprintf('Payout #%d needs attention: %s', $payout->id, $reason),
                'error',
                [
                    'payout_id' => $payout->id,
                    'amount' => $payout->amount,
                    'currency' => $payout->currency,
                    'reference' => $payout->provider_reference ?: 'Unavailable',
                    'masked_account' => $payout->payoutMethod?->maskedAccount(),
                    'reason' => $reason,
                    'admin_notification' => true,
                ],
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
                ['payout_id' => $payout->id, 'amount' => $payout->amount, 'currency' => $payout->currency, 'reference' => $payout->provider_reference ?: 'Unavailable', 'member' => $payout->user?->name, 'admin_notification' => true],
            ), $payout->getAttribute('demo_batch_id'));
        }

        return $payout->fresh(['reservation', 'user', 'payoutMethod']);
    }

    /**
     * Keep enough provider diagnostics to resolve a failed sandbox payout without
     * recording an access token, bank details, or the complete provider payload.
     *
     * @return array{provider_http_status?: int, provider_code?: mixed, provider_message?: mixed, provider_error_fields?: array<int, string>}
     */
    private function safeProviderFailureContext(\Throwable $exception): array
    {
        if (! $exception instanceof RequestException || ! $exception->response) {
            return [];
        }

        $body = $exception->response->json();

        $fields = collect(data_get($body, 'details.errors', []))
            ->map(static fn (mixed $error): ?string => is_array($error) ? data_get($error, 'source') : null)
            ->filter(static fn (mixed $source): bool => is_string($source) && $source !== '')
            ->unique()
            ->values()
            ->all();

        return array_filter([
            'provider_http_status' => $exception->response->status(),
            'provider_code' => is_array($body) ? data_get($body, 'code') : null,
            'provider_message' => is_array($body) ? data_get($body, 'message') : null,
            'provider_error_fields' => $fields ?: null,
        ], static fn (mixed $value): bool => $value !== null && $value !== '');
    }

    /** @param array{provider_error_fields?: array<int, string>, provider_http_status?: int, provider_code?: mixed, provider_message?: mixed} $context */
    private function payoutFailureReason(array $context): string
    {
        $fields = $context['provider_error_fields'] ?? [];
        if ($fields === []) {
            return 'The payout provider could not accept this payout. Review the payout method and retry.';
        }

        $labels = array_map(function (string $field): string {
            $key = str($field)->afterLast('.')->replace('_', ' ')->title()->toString();

            return match ($field) {
                'beneficiary.bank_details.bank_account_category' => 'bank account category',
                default => strtolower($key),
            };
        }, $fields);

        return 'Your payout method needs additional information: '.implode(', ', $labels).'. Update it and retry.';
    }
}
