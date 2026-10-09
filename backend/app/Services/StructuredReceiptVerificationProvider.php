<?php

namespace App\Services;

use App\Models\ProofSubmission;

class StructuredReceiptVerificationProvider implements ReceiptVerificationProviderInterface
{
    public function inspect(ProofSubmission $submission): array
    {
        return [
            'detected_amount' => $submission->purchase_amount ? (string) $submission->purchase_amount : null,
            'detected_date' => $submission->purchase_date?->toDateString(),
            'detected_time' => $submission->purchase_time?->format('H:i'),
            'detected_reference' => $submission->transaction_reference,
            'confidence_score' => 1.0,
            'raw_provider_response' => [
                'provider' => 'structured-form',
                'note' => 'Structured fields were supplied by the member; uploaded proof remains available for human review.',
            ],
        ];
    }
}
