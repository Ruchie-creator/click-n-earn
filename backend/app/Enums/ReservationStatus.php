<?php

namespace App\Enums;

enum ReservationStatus: string
{
    case RESERVED = 'reserved';
    case PROOF_SUBMITTED = 'proof_submitted';
    case UNDER_REVIEW = 'under_review';
    case CHANGES_REQUESTED = 'changes_requested';
    case REJECTED = 'rejected';
    case APPROVED = 'approved';
    case PROCESSING = 'processing';
    case PAYOUT_FAILED = 'payout_failed';
    case PAID = 'paid';
    case REVERSED = 'reversed';
    case CANCELLED = 'cancelled';
    case EXPIRED = 'expired';

    public function label(): string
    {
        return match ($this) {
            self::RESERVED => 'Reserved Reward',
            self::PROOF_SUBMITTED => 'Proof Submitted',
            self::UNDER_REVIEW => 'Under Review',
            self::PROCESSING, self::APPROVED => 'Processing',
            self::PAYOUT_FAILED => 'Payout needs attention',
            self::PAID => 'Paid',
            self::REVERSED => 'Reversed',
            self::CHANGES_REQUESTED => 'Changes Requested',
            self::REJECTED => 'Rejected',
            self::CANCELLED => 'Cancelled',
            self::EXPIRED => 'Expired',
        };
    }

    public function isActive(): bool
    {
        return in_array($this, [
            self::RESERVED,
            self::PROOF_SUBMITTED,
            self::UNDER_REVIEW,
            self::CHANGES_REQUESTED,
            self::APPROVED,
            self::PROCESSING,
            self::PAYOUT_FAILED,
        ], true);
    }
}
