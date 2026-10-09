<?php

namespace App\Http\Controllers\Api;

use App\Enums\ReservationStatus;
use App\Models\Payout;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

abstract class ApiController extends \App\Http\Controllers\Controller
{
    protected function ok(mixed $data = [], int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data], $status);
    }

    protected function message(string $message, int $status = 200, array $extra = []): JsonResponse
    {
        return response()->json(array_merge(['message' => $message], $extra), $status);
    }

    protected function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'country' => $user->country,
            'role' => $this->enumValue($user->role),
            'account_status' => $this->enumValue($user->account_status),
            'referral_code' => $user->referral_code,
            'email_verified_at' => $user->email_verified_at?->toISOString(),
            'avatar_url' => $user->avatar_path ? Storage::disk('public')->url($user->avatar_path) : null,
        ];
    }

    protected function taskPayload(Task $task): array
    {
        return [
            'id' => $task->id,
            'title' => $task->title,
            'slug' => $task->slug,
            'short_description' => str($task->description)->limit(130)->toString(),
            'description' => $task->description,
            'category' => $task->category,
            'image' => $task->image_path,
            'checkout_url' => $task->external_checkout_url,
            'product_price' => (float) $task->reimbursement_amount,
            'reimbursement_amount' => (float) $task->reimbursement_amount,
            'incentive' => (float) $task->incentive_amount,
            'expected_payout' => (float) $task->expected_payout,
            'slots' => max(0, $task->available_slots - $task->reserved_slots - $task->completed_slots),
            'available_slots' => $task->available_slots,
            'reserved_slots' => $task->reserved_slots,
            'completed_slots' => $task->completed_slots,
            'status' => $this->enumValue($task->status),
            'sponsor' => data_get($task->instructions, 'sponsor', 'Click & Earn partner'),
            'instructions' => $task->instructions ?: [],
            'requirements' => $task->proof_requirements ?: [],
            'starts_at' => $task->starts_at?->toISOString(),
            'expires_at' => $task->expires_at?->toISOString(),
        ];
    }

    protected function reservationPayload(TaskReservation $reservation): array
    {
        $reservation->loadMissing(['task', 'latestProofSubmission.verification']);
        $status = $this->enumValue($reservation->status);

        return [
            'id' => $reservation->id,
            'task_id' => $reservation->task_id,
            'task' => $reservation->task ? $this->taskPayload($reservation->task) : null,
            'reimbursement_amount' => (float) $reservation->reimbursement_amount,
            'incentive_amount' => (float) $reservation->incentive_amount,
            'expected_payout' => (float) $reservation->expected_payout,
            'status' => $status,
            'status_label' => $reservation->status instanceof ReservationStatus ? $reservation->status->label() : $status,
            'reserved_at' => $reservation->reserved_at?->toISOString(),
            'expires_at' => $reservation->expires_at?->toISOString(),
            'submitted_at' => $reservation->submitted_at?->toISOString(),
            'approved_at' => $reservation->approved_at?->toISOString(),
            'completed_at' => $reservation->completed_at?->toISOString(),
            'latest_proof' => $reservation->latestProofSubmission ? [
                'id' => $reservation->latestProofSubmission->id,
                'version' => $reservation->latestProofSubmission->version,
                'original_file_name' => $reservation->latestProofSubmission->original_file_name,
                'purchase_amount' => (float) $reservation->latestProofSubmission->purchase_amount,
                'purchase_date' => $reservation->latestProofSubmission->purchase_date?->toDateString(),
                'purchase_time' => $reservation->latestProofSubmission->purchase_time?->format('H:i'),
                'transaction_reference' => $reservation->latestProofSubmission->transaction_reference,
                'status' => $reservation->latestProofSubmission->status,
                'verification' => $reservation->latestProofSubmission->verification ? [
                    'confidence_score' => (float) $reservation->latestProofSubmission->verification->confidence_score,
                    'amount_matches' => $reservation->latestProofSubmission->verification->amount_matches,
                    'date_valid' => $reservation->latestProofSubmission->verification->date_valid,
                    'reference_present' => $reservation->latestProofSubmission->verification->reference_present,
                    'warnings' => $reservation->latestProofSubmission->verification->warnings ?: [],
                ] : null,
            ] : null,
        ];
    }

    protected function payoutPayload(Payout $payout): array
    {
        $payout->loadMissing('reservation');

        return [
            'id' => $payout->id,
            'reservation_id' => $payout->task_reservation_id,
            'referral_id' => $payout->referral_id,
            'amount' => (float) $payout->amount,
            'reimbursement_amount' => (float) ($payout->reservation?->reimbursement_amount ?? $payout->amount),
            'incentive_amount' => (float) ($payout->reservation?->incentive_amount ?? 0),
            'currency' => $payout->currency,
            'status' => $this->enumValue($payout->status),
            'provider' => $payout->provider,
            'provider_reference' => $payout->provider_reference,
            'manual_reference' => $payout->manual_reference,
            'requested_at' => $payout->requested_at?->toISOString(),
            'processing_at' => $payout->processing_at?->toISOString(),
            'paid_at' => $payout->paid_at?->toISOString(),
            'failed_at' => $payout->failed_at?->toISOString(),
            'failure_reason' => $payout->failure_reason,
        ];
    }

    protected function enumValue(mixed $value): ?string
    {
        return $value instanceof \BackedEnum ? $value->value : ($value === null ? null : (string) $value);
    }
}
