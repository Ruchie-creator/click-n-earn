<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\ProofSubmission;
use App\Services\ReceiptVerificationService;
use App\Services\VerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SubmissionController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = ProofSubmission::with(['user', 'reservation.task', 'verification'])->where('is_current', true);
        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        } else {
            $query->whereIn('status', ['proof_submitted', 'under_review']);
        }
        $query->latest();
        $items = $query->paginate(30);

        return $this->ok([
            'items' => $items->getCollection()->map(fn (ProofSubmission $submission): array => $this->payload($submission))->values(),
            'meta' => ['current_page' => $items->currentPage(), 'last_page' => $items->lastPage(), 'total' => $items->total()],
        ]);
    }

    public function show(ProofSubmission $submission): JsonResponse
    {
        return $this->ok($this->payload($submission->load(['user', 'reservation.task', 'verification'])));
    }

    public function review(ProofSubmission $submission, VerificationService $service): JsonResponse
    {
        return $this->ok($this->payload($service->moveToReview($submission, request()->user()->id)));
    }

    public function approve(ProofSubmission $submission, VerificationService $service): JsonResponse
    {
        $result = $service->approve($submission, request()->user()->id);

        return $this->ok([
            'reservation' => $this->reservationPayload($result['reservation']),
            'payout' => $this->payoutPayload($result['payout']),
        ]);
    }

    public function requestChanges(Request $request, ProofSubmission $submission, VerificationService $service): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);

        return $this->ok($this->payload($service->requestChanges($submission, $request->user()->id, $data['reason'])));
    }

    public function reject(Request $request, ProofSubmission $submission, VerificationService $service): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);

        return $this->ok($this->payload($service->reject($submission, $request->user()->id, $data['reason'])));
    }

    public function download(ProofSubmission $submission): mixed
    {
        $prefix = sprintf('proofs/%d/%d/', $submission->user_id, $submission->task_reservation_id);
        abort_unless(
            str_starts_with($submission->file_path, $prefix)
                && ! str_contains($submission->file_path, '..')
                && $submission->file_disk !== 'public',
            404,
        );
        abort_unless(Storage::disk($submission->file_disk)->exists($submission->file_path), 404);
        $fileName = basename(str_replace('\\', '/', $submission->original_file_name));
        $fileName = preg_replace('/[^\pL\pN._-]+/u', '_', $fileName) ?: 'proof';

        return Storage::disk($submission->file_disk)->download($submission->file_path, mb_substr($fileName, 0, 180));
    }

    private function payload(ProofSubmission $submission): array
    {
        $submission->loadMissing(['user', 'reservation.task', 'verification']);

        return [
            'id' => $submission->id,
            'reference' => 'SUB-'.str_pad((string) $submission->id, 4, '0', STR_PAD_LEFT),
            'member' => $submission->user?->name,
            'email' => $submission->user?->email,
            'task' => $submission->reservation?->task?->title,
            'reservation_id' => $submission->task_reservation_id,
            'reimbursement_amount' => (float) ($submission->reservation?->reimbursement_amount ?? 0),
            'incentive_amount' => (float) ($submission->reservation?->incentive_amount ?? 0),
            'expected_payout' => (float) ($submission->reservation?->expected_payout ?? 0),
            'purchase_amount' => (float) $submission->purchase_amount,
            'purchase_date' => $submission->purchase_date?->toDateString(),
            'purchase_time' => $submission->purchase_time?->format('H:i'),
            'transaction_reference' => $submission->transaction_reference,
            'status' => $submission->status,
            'file_name' => $submission->original_file_name,
            'download_url' => '/api/admin/submissions/'.$submission->id.'/download',
            'is_current' => $submission->is_current,
            'submitted_at' => $submission->submitted_at?->toISOString(),
            'user_note' => $submission->user_note,
            'verification' => $submission->verification ? [
                'detected_amount' => $submission->verification->detected_amount === null ? null : (float) $submission->verification->detected_amount,
                'detected_date' => $submission->verification->detected_date?->toDateString(),
                'detected_time' => $submission->verification->detected_time?->format('H:i'),
                'detected_reference' => $submission->verification->detected_reference,
                'confidence_score' => (float) $submission->verification->confidence_score,
                'amount_matches' => $submission->verification->amount_matches,
                'date_valid' => $submission->verification->date_valid,
                'reference_present' => $submission->verification->reference_present,
                'warnings' => $submission->verification->warnings ?: [],
            ] : null,
        ];
    }
}
