<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\PayoutStatus;
use App\Http\Controllers\Api\ApiController;
use App\Models\LedgerEntry;
use App\Models\Payout;
use App\Models\PayoutMethod;
use App\Models\ProofSubmission;
use App\Models\Referral;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends ApiController
{
    public function __invoke(): JsonResponse
    {
        return $this->ok([
            'stats' => [
                'active_tasks' => Task::where('status', 'available')->count(),
                'published_tasks' => Task::whereIn('status', ['available', 'paused'])->count(),
                'members' => User::where('role', 'member')->count(),
                'active_users' => User::where('account_status', 'active')->count(),
                'pending_submissions' => ProofSubmission::where('is_current', true)->whereIn('status', ['proof_submitted', 'under_review'])->count(),
                'pending_bank_verifications' => PayoutMethod::where('verification_status', 'pending_review')->where('status', '!=', 'deleted')->count(),
                'approved_bank_verifications' => PayoutMethod::where('verification_status', 'approved')->where('status', '!=', 'deleted')->count(),
                'bank_verifications_changes_requested' => PayoutMethod::where('verification_status', 'changes_requested')->where('status', '!=', 'deleted')->count(),
                'duplicate_payout_details' => PayoutMethod::whereNotNull('duplicate_flagged_at')->whereNull('duplicate_resolved_at')->where('status', '!=', 'deleted')->count(),
                'approved_payouts' => Payout::where('status', PayoutStatus::APPROVED->value)->sum('amount'),
                'pending_payouts' => Payout::whereIn('status', [PayoutStatus::APPROVED->value, PayoutStatus::PROCESSING->value])->sum('amount'),
                'processing_payouts' => Payout::where('status', PayoutStatus::PROCESSING->value)->sum('amount'),
                'paid_payouts' => Payout::where('status', PayoutStatus::PAID->value)->sum('amount'),
                'reserved_rewards' => LedgerEntry::whereIn('status', ['reserved', 'pending'])->where('direction', 'credit')->sum('amount'),
                'reserved_slots' => Task::sum('reserved_slots'),
                'referral_totals' => Referral::count(),
                'qualified_referrals' => Referral::whereNotNull('qualified_at')->count(),
                'referral_conversion_rate' => Referral::count() > 0 ? round((Referral::whereNotNull('qualified_at')->count() / Referral::count()) * 100, 2) : 0,
                'referral_rewards_paid' => Referral::where('reward_status', 'paid')->sum('reward_amount'),
                'pending_referral_approvals' => Referral::where('reward_status', 'pending_approval')->count(),
                'referral_rewards_awaiting_payout' => Referral::where('reward_status', 'approved')->count(),
            ],
            'queues' => [
                'verification' => ProofSubmission::with(['user', 'reservation.task', 'verification'])->where('is_current', true)->whereIn('status', ['proof_submitted', 'under_review'])->latest()->limit(10)->get()->map(fn (ProofSubmission $submission): array => $this->submissionPayload($submission)),
                'payouts' => Payout::with(['user', 'reservation.task'])->latest()->limit(10)->get()->map(fn (Payout $payout): array => array_merge($this->payoutPayload($payout), [
                    'member' => $payout->user?->name,
                    'task' => $payout->reservation?->task?->title,
                ])),
            ],
        ]);
    }

    protected function submissionPayload(ProofSubmission $submission): array
    {
        return [
            'id' => $submission->id,
            'reference' => 'SUB-'.str_pad((string) $submission->id, 4, '0', STR_PAD_LEFT),
            'member' => $submission->user?->name,
            'email' => $submission->user?->email,
            'task' => $submission->reservation?->task?->title,
            'amount' => (float) $submission->purchase_amount,
            'reimbursement_amount' => (float) ($submission->reservation?->reimbursement_amount ?? 0),
            'incentive' => (float) ($submission->reservation?->incentive_amount ?? 0),
            'expected_payout' => (float) ($submission->reservation?->expected_payout ?? 0),
            'status' => $submission->status,
            'submitted_at' => $submission->submitted_at?->toISOString(),
            'confidence' => $submission->verification ? (float) $submission->verification->confidence_score : null,
            'warnings' => $submission->verification?->warnings ?: [],
            'file_name' => $submission->original_file_name,
        ];
    }
}
