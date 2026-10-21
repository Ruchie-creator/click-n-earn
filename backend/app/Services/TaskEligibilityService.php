<?php

namespace App\Services;

use App\Models\PayoutMethod;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class TaskEligibilityService
{
    /** @return array{email_verified: bool, payout_verification_status: string, payout_masked_account: ?string, duplicate_review_required: bool, eligible_to_reserve: bool, eligibility_next_step: ?string, eligibility_message: ?string} */
    public function __construct(private readonly BankAccountRequirement $bankAccountRequirement) {}

    public function for(User $user): array
    {
        $method = $this->latestMethod($user);
        $payoutStatus = $method?->verification_status ?: 'not_submitted';
        $duplicateReviewRequired = $method !== null
            && $method->duplicate_flagged_at !== null
            && $method->duplicate_resolved_at === null;
        $emailVerified = $user->hasVerifiedEmail();
        $payoutApproved = $payoutStatus === 'approved'
            && $method?->status === 'active'
            && ! $duplicateReviewRequired;
        $activeAccount = $user->account_status?->value === 'active';
        $bankAccountRequired = $this->bankAccountRequirement->isRequired();
        $eligible = $activeAccount && $emailVerified && (! $bankAccountRequired || $payoutApproved);
        [$nextStep, $message] = $this->nextStep($emailVerified, $payoutStatus, $duplicateReviewRequired, $activeAccount, $bankAccountRequired);

        return [
            'email_verified' => $emailVerified,
            'payout_verification_status' => $duplicateReviewRequired ? 'pending_review' : $payoutStatus,
            'payout_masked_account' => $method?->maskedAccount(),
            'duplicate_review_required' => $duplicateReviewRequired,
            'bank_account_required_for_tasks' => $bankAccountRequired,
            'eligible_to_reserve' => $eligible,
            'eligibility_next_step' => $eligible ? null : $nextStep,
            'eligibility_message' => $eligible ? null : $message,
        ];
    }

    public function assertCanReserve(User $user): void
    {
        $eligibility = $this->for($user);
        if ($eligibility['eligible_to_reserve']) {
            return;
        }

        throw ValidationException::withMessages([
            'eligibility' => $eligibility['eligibility_message'] ?: 'Your account needs review before you can reserve tasks.',
        ]);
    }

    public function latestMethod(User $user): ?PayoutMethod
    {
        return $user->payoutMethods()
            ->where('status', '!=', 'deleted')
            ->latest('id')
            ->first();
    }

    /** @return array{?string, string} */
    private function nextStep(bool $emailVerified, string $payoutStatus, bool $duplicateReviewRequired, bool $activeAccount, bool $bankAccountRequired): array
    {
        if (! $activeAccount) {
            return ['account_review', 'Your account needs administrator review before you can reserve tasks.'];
        }
        if (! $emailVerified) {
            return ['verify_email', 'Verify your email address before reserving a task.'];
        }
        if (! $bankAccountRequired) {
            return [null, ''];
        }
        if ($duplicateReviewRequired) {
            return ['payout_review', 'Your payout information requires administrator review before you can reserve tasks.'];
        }

        return match ($payoutStatus) {
            'not_submitted' => ['add_bank_account', 'Add a bank account and wait for administrator approval before reserving tasks.'],
            'pending_review' => ['wait_for_payout_approval', 'Your bank account is pending administrator review. You can reserve tasks after it is approved.'],
            'changes_requested' => ['update_bank_account', 'Update your bank account details using the administrator’s note, then resubmit them for review.'],
            'rejected' => ['update_bank_account', 'Your bank account details were not approved. Review the administrator’s note and submit updated details.'],
            default => ['payout_review', 'Your payout information requires administrator review before you can reserve tasks.'],
        };
    }
}
