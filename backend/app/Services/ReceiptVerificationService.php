<?php

namespace App\Services;

use App\Models\ProofSubmission;
use App\Models\ReceiptVerification;
use App\Support\Money;
use Illuminate\Support\Carbon;

class ReceiptVerificationService
{
    public function __construct(
        private readonly ReceiptVerificationProviderInterface $provider,
    ) {
    }

    public function verify(ProofSubmission $submission): ReceiptVerification
    {
        $result = $this->provider->inspect($submission);
        $reservation = $submission->reservation()->with('task')->firstOrFail();
        $expectedAmount = Money::toCents((string) $reservation->reimbursement_amount);
        $detectedAmount = $result['detected_amount'] !== null
            ? Money::toCents((string) $result['detected_amount'])
            : null;
        $date = $result['detected_date'] ? Carbon::parse($result['detected_date']) : null;
        $warnings = [];

        if ($detectedAmount === null || $detectedAmount !== $expectedAmount) {
            $warnings[] = 'The submitted purchase amount does not match the task reimbursement amount.';
        }
        if (! $date) {
            $warnings[] = 'The proof does not include a purchase date.';
        } elseif ($date->greaterThan(now()->addDay())) {
            $warnings[] = 'The purchase date is in the future.';
        }
        if (blank($result['detected_reference'])) {
            $warnings[] = 'No transaction reference was detected.';
        }
        $dateValid = $date !== null && ! $date->isFuture();
        $fieldConfidence = ($detectedAmount === $expectedAmount ? 0.5 : 0)
            + ($dateValid ? 0.25 : 0)
            + (filled($result['detected_reference']) ? 0.25 : 0);
        $confidence = round($fieldConfidence * (float) $result['confidence_score'], 2);

        $verification = ReceiptVerification::updateOrCreate(
            ['proof_submission_id' => $submission->id],
            [
                'provider' => 'structured-form',
                'detected_amount' => $result['detected_amount'],
                'detected_date' => $result['detected_date'],
                'detected_time' => $result['detected_time'],
                'detected_reference' => $result['detected_reference'],
                'confidence_score' => $confidence,
                'amount_matches' => $detectedAmount === $expectedAmount,
                'date_valid' => $dateValid,
                'reference_present' => filled($result['detected_reference']),
                'warnings' => $warnings,
                'raw_provider_response' => $result['raw_provider_response'],
            ],
        );

        if ($batchId = $submission->getAttribute('demo_batch_id')) {
            $verification->forceFill(['demo_batch_id' => $batchId])->save();
        }

        return $verification;
    }
}
