<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReferralController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $items = $user->referralsSent()->with(['referredUser', 'qualifyingReservation.task', 'qualifyingReservation.latestProofSubmission', 'payout'])->latest()->get()->map(fn ($referral): array => [
            'id' => $referral->id,
            'name' => $referral->referredUser?->name,
            'joined_at' => $referral->registered_at?->toISOString(),
            'qualified_at' => $referral->qualified_at?->toISOString(),
            'status' => $referral->qualified_at ? 'Successful' : 'Task in progress',
            'reward' => (float) $referral->reward_amount,
            'reward_status' => $referral->reward_status,
            'task' => $referral->qualifyingReservation?->task?->title,
            'qualifying_purchase' => $referral->qualifyingReservation ? [
                'task' => $referral->qualifyingReservation->task?->title,
                'purchase_amount' => (float) ($referral->qualifyingReservation->latestProofSubmission?->purchase_amount ?? 0),
                'approved_at' => $referral->qualifyingReservation->approved_at?->toISOString(),
            ] : null,
            'qualification_status' => $referral->qualified_at ? 'qualified' : 'pending',
            'payout_status' => $referral->payout?->status?->value ?? $referral->payout?->status,
            'paid_at' => $referral->paid_at?->toISOString(),
        ]);

        return $this->ok([
            'code' => $user->referral_code,
            'items' => $items,
            'qualified_count' => $items->where('status', 'Successful')->count(),
            'pending_count' => $items->where('status', '!=', 'Successful')->count(),
        ]);
    }
}
