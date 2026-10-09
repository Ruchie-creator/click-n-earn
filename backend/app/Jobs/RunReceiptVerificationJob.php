<?php

namespace App\Jobs;

use App\Models\ProofSubmission;
use App\Services\ReceiptVerificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class RunReceiptVerificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly int $proofSubmissionId)
    {
    }

    public function handle(ReceiptVerificationService $service): void
    {
        $submission = ProofSubmission::query()->find($this->proofSubmissionId);
        if ($submission) {
            $service->verify($submission);
        }
    }
}
