<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\AuditLog;
use App\Models\Payout;
use App\Models\Referral;
use App\Notifications\EventNotification;
use App\Services\AuditLogService;
use App\Services\EventNotificationService;
use App\Services\PayoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReferralController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Referral::query()->with(['referrer', 'referredUser', 'qualifyingReservation.task', 'payout']);
        if ($request->filled('status') && $request->string('status')->toString() !== 'all') {
            $query->where('reward_status', $request->string('status')->toString());
        }
        if ($request->boolean('needs_review')) {
            $query->whereNotNull('self_abuse_flagged_at')->whereNull('self_abuse_resolved_at');
        }
        if ($request->filled('search')) {
            $search = trim($request->string('search')->toString());
            $query->where(fn ($builder) => $builder->whereHas('referrer', fn ($user) => $user->where('name', 'ilike', '%'.$search.'%')->orWhere('email', 'ilike', '%'.$search.'%'))
                ->orWhereHas('referredUser', fn ($user) => $user->where('name', 'ilike', '%'.$search.'%')->orWhere('email', 'ilike', '%'.$search.'%')));
        }
        $items = $query->latest()->paginate(30);

        return $this->ok([
            'items' => $items->getCollection()->map(fn (Referral $referral): array => $this->payload($referral))->values(),
            'summary' => [
                'total' => Referral::count(),
                'pending_approval' => Referral::where('reward_status', 'pending_approval')->count(),
                'held' => Referral::where('reward_status', 'held')->count(),
                'suspicious' => Referral::whereNotNull('self_abuse_flagged_at')->whereNull('self_abuse_resolved_at')->count(),
                'awaiting_payout' => Referral::where('reward_status', 'approved')->count(),
                'payout_failed' => Referral::where('reward_status', 'payout_failed')->count(),
                'paid_amount' => (float) Referral::where('reward_status', 'paid')->sum('reward_amount'),
            ],
            'meta' => ['current_page' => $items->currentPage(), 'last_page' => $items->lastPage(), 'total' => $items->total()],
        ]);
    }

    public function show(Referral $referral): JsonResponse
    {
        $referral->load(['referrer', 'referredUser', 'qualifyingReservation.task', 'payout.payoutMethod', 'rewardDecider', 'selfAbuseResolver']);

        return $this->ok([
            ...$this->payload($referral),
            'qualifying_purchase' => $referral->qualifyingReservation ? [
                'reservation_id' => $referral->qualifyingReservation->id,
                'task_id' => $referral->qualifyingReservation->task_id,
                'task' => $referral->qualifyingReservation->task?->title,
                'purchase_amount' => (float) ($referral->qualifyingReservation->latestProofSubmission?->purchase_amount ?? 0),
                'approved_at' => $referral->qualifyingReservation->approved_at?->toISOString(),
                'completed_at' => $referral->qualifyingReservation->completed_at?->toISOString(),
            ] : null,
            'payout' => $referral->payout ? [
                'id' => $referral->payout->id,
                'status' => $this->enumValue($referral->payout->status),
                'amount' => (float) $referral->payout->amount,
                'currency' => $referral->payout->currency,
                'provider_reference' => $referral->payout->provider_reference,
                'manual_reference' => $referral->payout->manual_reference,
                'masked_account' => $referral->payout->payoutMethod?->maskedAccount(),
                'requested_at' => $referral->payout->requested_at?->toISOString(),
                'paid_at' => $referral->payout->paid_at?->toISOString(),
            ] : null,
            'history' => AuditLog::query()->with('actor')->where('subject_type', $referral->getMorphClass())->where('subject_id', $referral->id)->latest()->limit(50)->get()->map(fn (AuditLog $log): array => [
                'id' => $log->id,
                'action' => $log->action,
                'actor' => $log->actor?->name,
                'before' => $log->before_data,
                'after' => $log->after_data,
                'created_at' => $log->created_at?->toISOString(),
            ])->values(),
        ]);
    }

    public function approve(Request $request, Referral $referral, PayoutService $payouts, AuditLogService $audit, EventNotificationService $notifications): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']]);
        $payout = DB::transaction(function () use ($request, $referral, $payouts, $audit, $data): Payout {
            $locked = Referral::query()->lockForUpdate()->findOrFail($referral->id);
            if (! $locked->qualified_at || ! in_array($locked->reward_status, ['pending_approval', 'held'], true)) {
                throw ValidationException::withMessages(['status' => 'This referral reward is not awaiting approval.']);
            }
            if ($locked->self_abuse_flagged_at && ! $locked->self_abuse_resolved_at) {
                throw ValidationException::withMessages(['status' => 'Resolve the flagged referral review before approving the reward.']);
            }
            $before = ['reward_status' => $locked->reward_status, 'reward_hold_reason' => $locked->reward_hold_reason];
            $locked->forceFill([
                'reward_status' => 'approved',
                'reward_decided_at' => now(),
                'reward_decided_by' => $request->user()->id,
                'reward_hold_reason' => null,
            ])->save();
            $payout = $payouts->createApprovedForReferral($locked);
            $audit->record('referral.reward_approved', $locked, $request, before: $before, after: ['reward_status' => 'approved', 'payout_id' => $payout->id], actorId: $request->user()->id, reason: $data['note'] ?? null);

            return $payout;
        });
        $referral->load('referrer');
        if ($referral->referrer) {
            $notifications->notifyOnce($referral->referrer, 'referral.reward_approved.'.$referral->id, new EventNotification(
                'Referral reward approved',
                'Your referral reward was approved and added to the payout queue.',
                'success',
                ['event_key' => 'referral.reward_approved', 'referral_id' => $referral->id, 'reward_amount' => $referral->reward_amount, 'currency' => $payout->currency],
            ), $referral->getAttribute('demo_batch_id'));
        }

        return $this->ok(['referral' => $this->payload($referral->fresh(['referrer', 'referredUser', 'qualifyingReservation.task', 'payout'])), 'payout_id' => $payout->id]);
    }

    public function hold(Request $request, Referral $referral, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $updated = DB::transaction(function () use ($request, $referral, $audit, $data): Referral {
            $locked = Referral::query()->lockForUpdate()->findOrFail($referral->id);
            if (! $locked->qualified_at || ! in_array($locked->reward_status, ['pending_approval', 'held'], true)) {
                throw ValidationException::withMessages(['status' => 'Only an unpaid referral reward awaiting review can be held.']);
            }
            $before = ['reward_status' => $locked->reward_status, 'reward_hold_reason' => $locked->reward_hold_reason];
            $locked->forceFill([
                'reward_status' => 'held',
                'reward_decided_at' => now(),
                'reward_decided_by' => $request->user()->id,
                'reward_hold_reason' => trim($data['reason']),
            ])->save();
            $audit->record('referral.reward_held', $locked, $request, before: $before, after: ['reward_status' => 'held'], actorId: $request->user()->id, reason: trim($data['reason']));

            return $locked->fresh(['referrer', 'referredUser', 'qualifyingReservation.task', 'payout']);
        });

        return $this->ok($this->payload($updated));
    }

    public function resolveReview(Request $request, Referral $referral, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $updated = DB::transaction(function () use ($request, $referral, $audit, $data): Referral {
            $locked = Referral::query()->lockForUpdate()->findOrFail($referral->id);
            if (! $locked->self_abuse_flagged_at || $locked->self_abuse_resolved_at) {
                throw ValidationException::withMessages(['status' => 'This referral has no unresolved account-match review.']);
            }
            $locked->forceFill([
                'self_abuse_resolved_at' => now(),
                'self_abuse_resolved_by' => $request->user()->id,
                'self_abuse_note' => trim($data['reason']),
            ])->save();
            $audit->record('referral.match_review_resolved', $locked, $request, after: ['self_abuse_resolved_at' => $locked->self_abuse_resolved_at?->toISOString()], actorId: $request->user()->id, reason: trim($data['reason']));

            return $locked->fresh(['referrer', 'referredUser', 'qualifyingReservation.task', 'payout']);
        });

        return $this->ok($this->payload($updated));
    }

    /** @return array<string, mixed> */
    private function payload(Referral $referral): array
    {
        $referral->loadMissing(['referrer', 'referredUser', 'qualifyingReservation.task', 'payout']);

        return [
            'id' => $referral->id,
            'referrer' => $referral->referrer?->name,
            'referrer_email' => $referral->referrer?->email,
            'referred_user' => $referral->referredUser?->name,
            'referred_email' => $referral->referredUser?->email,
            'referral_code' => $referral->referral_code,
            'status' => $referral->qualified_at ? 'Qualified' : 'Task in progress',
            'qualification_status' => $referral->qualified_at ? 'qualified' : 'pending',
            'reward' => (float) $referral->reward_amount,
            'reward_status' => $referral->reward_status,
            'reward_hold_reason' => $referral->reward_hold_reason,
            'registered_at' => $referral->registered_at?->toISOString(),
            'qualified_at' => $referral->qualified_at?->toISOString(),
            'paid_at' => $referral->paid_at?->toISOString(),
            'qualifying_reservation_id' => $referral->qualifying_task_reservation_id,
            'qualifying_task' => $referral->qualifyingReservation?->task?->title,
            'possible_duplicate_account' => $referral->self_abuse_flagged_at !== null,
            'review_unresolved' => $referral->self_abuse_flagged_at !== null && $referral->self_abuse_resolved_at === null,
            'review_note' => $referral->self_abuse_note,
            'decided_by' => $referral->rewardDecider?->name,
            'payout_id' => $referral->payout?->id,
            'payout_status' => $referral->payout ? $this->enumValue($referral->payout->status) : null,
            'payout_reference' => $referral->payout?->provider_reference ?: $referral->payout?->manual_reference,
        ];
    }
}
