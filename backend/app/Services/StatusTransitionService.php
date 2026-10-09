<?php

namespace App\Services;

use App\Models\StatusHistory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class StatusTransitionService
{
    private const RESERVATION_TRANSITIONS = [
        'reserved' => ['proof_submitted', 'expired', 'cancelled'],
        'proof_submitted' => ['under_review', 'rejected'],
        'under_review' => ['approved', 'changes_requested', 'rejected'],
        'changes_requested' => ['proof_submitted', 'cancelled', 'expired'],
        'approved' => ['processing', 'payout_failed', 'cancelled'],
        'processing' => ['paid', 'payout_failed', 'reversed'],
        'payout_failed' => ['approved', 'processing', 'paid'],
        'paid' => ['reversed'],
        'reversed' => [],
        'rejected' => [],
        'cancelled' => [],
        'expired' => [],
    ];

    public function transition(
        Model $subject,
        string $toStatus,
        ?int $actorId = null,
        ?string $reason = null,
        array $metadata = [],
    ): Model {
        $fromStatus = $this->statusValue($subject);

        if ($fromStatus === $toStatus) {
            return $subject;
        }

        $allowed = match ($subject->getTable()) {
            'task_reservations' => self::RESERVATION_TRANSITIONS[$fromStatus] ?? [],
            default => [],
        };

        if (! in_array($toStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => "Illegal status transition: {$fromStatus} → {$toStatus}.",
            ]);
        }

        $subject->status = $toStatus;
        $this->setTransitionTimestamp($subject, $toStatus);
        $subject->save();

        $history = StatusHistory::create([
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'actor_id' => $actorId,
            'reason' => $reason,
            'metadata' => $metadata,
        ]);
        if ($batchId = $subject->getAttribute('demo_batch_id')) {
            $history->forceFill(['demo_batch_id' => $batchId])->save();
        }

        return $subject;
    }

    public function recordInitial(Model $subject, ?int $actorId = null, array $metadata = []): void
    {
        $history = StatusHistory::create([
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'from_status' => null,
            'to_status' => $this->statusValue($subject),
            'actor_id' => $actorId,
            'metadata' => $metadata,
        ]);
        if ($batchId = $subject->getAttribute('demo_batch_id')) {
            $history->forceFill(['demo_batch_id' => $batchId])->save();
        }
    }

    private function statusValue(Model $subject): string
    {
        $status = $subject->getAttribute('status');

        return $status instanceof \BackedEnum ? $status->value : (string) $status;
    }

    private function setTransitionTimestamp(Model $subject, string $toStatus): void
    {
        $now = now();
        match ($toStatus) {
            'proof_submitted' => $subject->submitted_at = $now,
            'approved' => $subject->approved_at = $now,
            'paid' => $subject->completed_at = $now,
            default => null,
        };
    }
}
