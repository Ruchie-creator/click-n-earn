<?php

namespace App\Services;

use App\Models\ProofSubmission;

interface ReceiptVerificationProviderInterface
{
    /**
     * @return array{
     *     detected_amount: string|null,
     *     detected_date: string|null,
     *     detected_time: string|null,
     *     detected_reference: string|null,
     *     confidence_score: float,
     *     raw_provider_response: array<string, mixed>
     * }
     */
    public function inspect(ProofSubmission $submission): array;
}
