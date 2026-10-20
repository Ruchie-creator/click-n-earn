<?php

namespace App\Services;

use App\Enums\LedgerStatus;
use App\Enums\ReservationStatus;
use App\Models\ProofSubmission;
use App\Models\TaskReservation;
use App\Notifications\EventNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VerificationService
{
    public function __construct(
        private readonly StatusTransitionService $transitions,
        private readonly LedgerService $ledger,
        private readonly PayoutService $payouts,
        private readonly ReferralService $referrals,
        private readonly AuditLogService $audit,
        private readonly ReservationCapacityService $capacity,
        private readonly EventNotificationService $notifications,
    ) {}

    public function moveToReview(ProofSubmission $submission, int $actorId): ProofSubmission
    {
        return DB::transaction(function () use ($submission, $actorId): ProofSubmission {
            [$proof, $reservation] = $this->lockProofAndReservation($submission->id, ['user', 'task']);
            if ($reservation->status === ReservationStatus::UNDER_REVIEW) {
                return $proof->fresh(['reservation', 'verification']);
            }
            if ($reservation->status !== ReservationStatus::PROOF_SUBMITTED) {
                throw ValidationException::withMessages(['status' => 'Only submitted proof can be moved into review.']);
            }

            $this->transitions->transition($reservation, ReservationStatus::UNDER_REVIEW->value, $actorId, 'Admin review started.', ['proof_submission_id' => $proof->id]);
            $proof->forceFill(['status' => ReservationStatus::UNDER_REVIEW->value])->save();
            $this->audit->record('proof.review_started', $proof, actorId: $actorId, after: $proof->toArray());
            $this->notifications->notifyOnce($reservation->user, 'proof.review_started.'.$proof->id, new EventNotification(
                'Proof under review',
                'Your proof has been opened by the verification team.',
                'processing',
                ['reservation_id' => $reservation->id, 'task_id' => $reservation->task_id, 'proof_submission_id' => $proof->id],
            ), $reservation->getAttribute('demo_batch_id'));

            return $proof->fresh(['reservation', 'verification']);
        });
    }

    public function approve(ProofSubmission $submission, int $actorId): array
    {
        return DB::transaction(function () use ($submission, $actorId): array {
            [$proof, $reservation] = $this->lockProofAndReservation($submission->id, ['user', 'task']);
            if ($reservation->status === ReservationStatus::APPROVED && $proof->status === ReservationStatus::APPROVED->value) {
                $payout = $reservation->payout()->first();
                if (! $payout) {
                    throw new \LogicException('An approved reservation has no corresponding payout.');
                }

                return ['reservation' => $reservation->fresh(['task']), 'payout' => $payout->fresh()];
            }
            if ($reservation->status !== ReservationStatus::UNDER_REVIEW) {
                throw ValidationException::withMessages(['status' => 'Only proof under review can be approved.']);
            }
            if (! $proof->is_current) {
                throw ValidationException::withMessages(['status' => 'Only the current proof submission can be approved.']);
            }

            $hasPriorApproved = $reservation->user->reservations()
                ->where('id', '!=', $reservation->id)
                ->whereIn('status', [
                    ReservationStatus::APPROVED->value,
                    ReservationStatus::PROCESSING->value,
                    ReservationStatus::PAYOUT_FAILED->value,
                    ReservationStatus::PAID->value,
                    ReservationStatus::REVERSED->value,
                ])->exists();

            $this->transitions->transition($reservation, ReservationStatus::APPROVED->value, $actorId, 'Proof approved.', ['proof_submission_id' => $proof->id]);
            $reservation->forceFill(['approved_at' => now()])->save();
            $proof->forceFill(['status' => ReservationStatus::APPROVED->value])->save();
            $this->ledger->updateReservationStatus($reservation, LedgerStatus::PENDING);
            $payout = $this->payouts->createApprovedForReservation($reservation);
            if (! $hasPriorApproved) {
                $this->referrals->qualifyAfterApprovedTask($reservation->user, $reservation);
            }
            $this->audit->record('proof.approved', $proof, actorId: $actorId, after: $proof->toArray());

            $this->notifications->notifyOnce($reservation->user, 'proof.approved.'.$proof->id, new EventNotification(
                'Proof approved',
                sprintf('Your proof for %s was approved. Your expected payout will now move through the payout process.', $reservation->task->title),
                'success',
                ['reservation_id' => $reservation->id, 'task_id' => $reservation->task_id, 'task' => $reservation->task->title, 'proof_submission_id' => $proof->id, 'payout_id' => $payout->id, 'reimbursement_amount' => $reservation->reimbursement_amount, 'incentive_amount' => $reservation->incentive_amount, 'expected_payout' => $reservation->expected_payout, 'currency' => $payout->currency],
            ), $reservation->getAttribute('demo_batch_id'));
            $this->notifications->notifyAdmins('proof.approved.'.$proof->id, new EventNotification(
                'Proof approved',
                sprintf('%s\'s proof for %s was approved. The related payout can now be processed through the normal payout workflow.', $reservation->user->name, $reservation->task->title),
                'success',
                ['reservation_id' => $reservation->id, 'task_id' => $reservation->task_id, 'task' => $reservation->task->title, 'member' => $reservation->user->name, 'proof_submission_id' => $proof->id, 'payout_id' => $payout->id, 'reimbursement_amount' => $reservation->reimbursement_amount, 'incentive_amount' => $reservation->incentive_amount, 'expected_payout' => $reservation->expected_payout, 'currency' => $payout->currency, 'admin_notification' => true],
            ), $reservation->getAttribute('demo_batch_id'));

            return ['reservation' => $reservation->fresh(['task']), 'payout' => $payout->fresh()];
        });
    }

    public function requestChanges(ProofSubmission $submission, int $actorId, string $reason): ProofSubmission
    {
        if (blank(trim($reason))) {
            throw ValidationException::withMessages(['reason' => 'A reason is required when requesting changes.']);
        }

        return DB::transaction(function () use ($submission, $actorId, $reason): ProofSubmission {
            [$proof, $reservation] = $this->lockProofAndReservation($submission->id, ['user']);
            if ($reservation->status === ReservationStatus::CHANGES_REQUESTED) {
                return $proof->fresh(['reservation']);
            }
            if ($reservation->status !== ReservationStatus::UNDER_REVIEW) {
                throw ValidationException::withMessages(['status' => 'Only proof under review can be sent back for changes.']);
            }

            $this->transitions->transition($reservation, ReservationStatus::CHANGES_REQUESTED->value, $actorId, $reason);
            $proof->forceFill(['status' => ReservationStatus::CHANGES_REQUESTED->value])->save();
            $this->audit->record('proof.changes_requested', $proof, actorId: $actorId, after: $proof->toArray(), reason: $reason);
            $this->notifications->notifyOnce($reservation->user, 'proof.changes_requested.'.$proof->id, new EventNotification(
                'Changes requested',
                sprintf('The verification team requested a review of your proof for %s. Each task allows one proof submission; contact support if you need help with the reviewer’s note.', $reservation->task->title),
                'warning',
                ['reservation_id' => $reservation->id, 'task_id' => $reservation->task_id, 'task' => $reservation->task->title, 'proof_submission_id' => $proof->id, 'reviewer_note' => $reason],
            ), $reservation->getAttribute('demo_batch_id'));
            $this->notifications->notifyAdmins('proof.changes_requested.'.$proof->id, new EventNotification(
                'Changes requested for proof',
                sprintf('Changes were requested for %s\'s proof for %s.', $reservation->user->name, $reservation->task->title),
                'warning',
                ['reservation_id' => $reservation->id, 'task_id' => $reservation->task_id, 'task' => $reservation->task->title, 'member' => $reservation->user->name, 'proof_submission_id' => $proof->id, 'reviewer_note' => $reason, 'admin_notification' => true],
            ), $reservation->getAttribute('demo_batch_id'));

            return $proof->fresh(['reservation']);
        });
    }

    public function reject(ProofSubmission $submission, int $actorId, string $reason): ProofSubmission
    {
        if (blank(trim($reason))) {
            throw ValidationException::withMessages(['reason' => 'A reason is required when rejecting proof.']);
        }

        return DB::transaction(function () use ($submission, $actorId, $reason): ProofSubmission {
            [$proof, $reservation] = $this->lockProofAndReservation($submission->id, ['user', 'task']);
            if ($reservation->status === ReservationStatus::REJECTED && $proof->status === ReservationStatus::REJECTED->value) {
                return $proof->fresh(['reservation']);
            }
            if (! in_array($reservation->status, [ReservationStatus::UNDER_REVIEW, ReservationStatus::PROOF_SUBMITTED], true)) {
                throw ValidationException::withMessages(['status' => 'This proof cannot be rejected at its current status.']);
            }

            $this->transitions->transition($reservation, ReservationStatus::REJECTED->value, $actorId, $reason);
            $proof->forceFill(['status' => ReservationStatus::REJECTED->value])->save();
            $this->ledger->updateReservationStatus($reservation, LedgerStatus::CANCELLED);
            $this->capacity->release($reservation);
            $this->audit->record('proof.rejected', $proof, actorId: $actorId, after: $proof->toArray(), reason: $reason);
            $this->notifications->notifyOnce($reservation->user, 'proof.rejected.'.$proof->id, new EventNotification(
                'Proof rejected',
                sprintf('Your proof for %s could not be approved. Please review the details below.', $reservation->task->title),
                'error',
                ['reservation_id' => $proof->task_reservation_id, 'task_id' => $reservation->task_id, 'task' => $reservation->task->title, 'proof_submission_id' => $proof->id, 'reason' => $reason],
            ), $reservation->getAttribute('demo_batch_id'));
            $this->notifications->notifyAdmins('proof.rejected.'.$proof->id, new EventNotification(
                'Proof rejected',
                sprintf('%s\'s proof for %s was rejected.', $reservation->user->name, $reservation->task->title),
                'error',
                ['reservation_id' => $reservation->id, 'task_id' => $reservation->task_id, 'task' => $reservation->task->title, 'member' => $reservation->user->name, 'proof_submission_id' => $proof->id, 'reason' => $reason, 'admin_notification' => true],
            ), $reservation->getAttribute('demo_batch_id'));

            return $proof->fresh(['reservation']);
        });
    }

    /** @return array{ProofSubmission, TaskReservation} */
    private function lockProofAndReservation(int $proofId, array $reservationRelations = []): array
    {
        $reservationId = ProofSubmission::query()->whereKey($proofId)->value('task_reservation_id');
        abort_if($reservationId === null, 404);

        $reservation = TaskReservation::query()
            ->with($reservationRelations)
            ->lockForUpdate()
            ->findOrFail($reservationId);
        $proof = ProofSubmission::query()->lockForUpdate()->findOrFail($proofId);

        if ((int) $proof->task_reservation_id !== (int) $reservation->id) {
            throw new \LogicException('The proof reservation changed while acquiring review locks.');
        }
        $proof->setRelation('reservation', $reservation);

        return [$proof, $reservation];
    }
}
