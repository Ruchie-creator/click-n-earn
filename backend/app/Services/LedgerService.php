<?php

namespace App\Services;

use App\Enums\LedgerDirection;
use App\Enums\LedgerStatus;
use App\Enums\LedgerType;
use App\Models\LedgerEntry;
use App\Models\Referral;
use App\Models\TaskReservation;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LedgerService
{
    public function reserveTaskReward(TaskReservation $reservation): void
    {
        $this->entry($reservation->user, LedgerType::TASK_REIMBURSEMENT, (string) $reservation->reimbursement_amount, LedgerDirection::CREDIT, LedgerStatus::RESERVED, $reservation, 'reservation-'.$reservation->id.'-task-reimbursement');
        $this->entry($reservation->user, LedgerType::TASK_INCENTIVE, (string) $reservation->incentive_amount, LedgerDirection::CREDIT, LedgerStatus::RESERVED, $reservation, 'reservation-'.$reservation->id.'-task-incentive');
    }

    public function updateReservationStatus(TaskReservation $reservation, LedgerStatus $status): void
    {
        $reservation->ledgerEntries()->whereIn('type', [
            LedgerType::TASK_REIMBURSEMENT->value,
            LedgerType::TASK_INCENTIVE->value,
        ])->update(['status' => $status->value]);
    }

    public function issueReferralReward(Referral $referral): LedgerEntry
    {
        return $this->entry(
            $referral->referrer,
            LedgerType::REFERRAL_REWARD,
            (string) $referral->reward_amount,
            LedgerDirection::CREDIT,
            LedgerStatus::PENDING,
            null,
            'referral-'.$referral->id,
            ['referral_id' => $referral->id],
            $referral,
        );
    }

    public function totals(User $user): array
    {
        $sum = static fn (Builder|HasMany $query): string => (string) $query->sum('amount');
        $base = $user->ledgerEntries()->where('direction', LedgerDirection::CREDIT->value);

        return [
            'pending_earnings' => $sum((clone $base)->whereIn('status', [LedgerStatus::RESERVED->value, LedgerStatus::PENDING->value])),
            'processing_payouts' => $sum((clone $base)->where('status', LedgerStatus::PROCESSING->value)),
            'paid_earnings' => $sum((clone $base)->where('status', LedgerStatus::PAID->value)),
            'referral_earnings' => $sum((clone $base)->where('type', LedgerType::REFERRAL_REWARD->value)->where('status', LedgerStatus::PAID->value)),
        ];
    }

    private function entry(
        User $user,
        LedgerType $type,
        string $amount,
        LedgerDirection $direction,
        LedgerStatus $status,
        ?TaskReservation $reservation,
        string $referenceSuffix,
        array $metadata = [],
        ?Referral $referral = null,
    ): LedgerEntry {
        $entry = LedgerEntry::firstOrCreate(
            ['reference' => sprintf('%s-%s-%s', $type->value, $user->id, $referenceSuffix)],
            [
                'user_id' => $user->id,
                'task_reservation_id' => $reservation?->id,
                'referral_id' => $referral?->id,
                'type' => $type,
                'amount' => $amount,
                'direction' => $direction,
                'status' => $status,
                'metadata' => $metadata,
            ],
        );

        $demoBatchId = $reservation?->getAttribute('demo_batch_id') ?: $referral?->getAttribute('demo_batch_id');
        if ($demoBatchId && $entry->getAttribute('demo_batch_id') !== $demoBatchId) {
            $entry->forceFill(['demo_batch_id' => $demoBatchId])->save();
        }

        return $entry;
    }
}
