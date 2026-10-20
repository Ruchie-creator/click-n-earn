<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\PayoutMethod;
use App\Notifications\EventNotification;
use App\Services\AuditLogService;
use App\Services\EventNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayoutVerificationController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = PayoutMethod::query()->with('user')->where('status', '!=', 'deleted')->latest();
        if ($request->filled('status') && $request->string('status')->toString() !== 'all') {
            $query->where('verification_status', $request->string('status')->toString());
        } elseif (! $request->boolean('include_resolved')) {
            $query->whereIn('verification_status', ['pending_review', 'changes_requested']);
        }
        if ($request->boolean('duplicates_only')) {
            $query->whereNotNull('duplicate_flagged_at');
        }

        $items = $query->paginate(30);

        return $this->ok([
            'items' => $items->getCollection()->map(fn (PayoutMethod $method): array => $this->summaryPayload($method))->values(),
            'summary' => [
                'pending' => PayoutMethod::where('verification_status', 'pending_review')->where('status', '!=', 'deleted')->count(),
                'approved' => PayoutMethod::where('verification_status', 'approved')->where('status', '!=', 'deleted')->count(),
                'changes_requested' => PayoutMethod::where('verification_status', 'changes_requested')->where('status', '!=', 'deleted')->count(),
                'duplicates' => PayoutMethod::whereNotNull('duplicate_flagged_at')->whereNull('duplicate_resolved_at')->where('status', '!=', 'deleted')->count(),
            ],
            'meta' => ['current_page' => $items->currentPage(), 'last_page' => $items->lastPage(), 'total' => $items->total()],
        ]);
    }

    public function show(PayoutMethod $payoutMethod): JsonResponse
    {
        return $this->ok([
            ...$this->summaryPayload($payoutMethod->load(['user', 'verifier'])),
            'bank_details' => [
                'account_holder_name' => $payoutMethod->account_holder_name,
                'account_type' => $payoutMethod->account_type,
                'entity_type' => $payoutMethod->entity_type,
                'transfer_method' => $payoutMethod->transfer_method,
                'country' => $payoutMethod->country,
                'currency' => $payoutMethod->currency,
                'account_details' => $payoutMethod->account_details ?: [],
                'routing_details' => $payoutMethod->routing_details ?: [],
                'beneficiary_address' => $payoutMethod->beneficiary_address ?: [],
            ],
            'duplicate_matches' => $this->duplicateMatches($payoutMethod),
            'history' => $this->history($payoutMethod),
        ]);
    }

    public function approve(Request $request, PayoutMethod $payoutMethod, AuditLogService $audit, EventNotificationService $notifications): JsonResponse
    {
        abort_unless($payoutMethod->user_id !== $request->user()->id, 403, 'Administrators cannot approve their own bank details.');
        abort_if($payoutMethod->duplicate_flagged_at && ! $payoutMethod->duplicate_resolved_at, 422, 'Resolve the matching payout information review before approving this account.');

        return $this->decide($request, $payoutMethod, 'approved', null, $audit, $notifications);
    }

    public function reject(Request $request, PayoutMethod $payoutMethod, AuditLogService $audit, EventNotificationService $notifications): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        abort_unless($payoutMethod->user_id !== $request->user()->id, 403, 'Administrators cannot reject their own bank details.');

        return $this->decide($request, $payoutMethod, 'rejected', trim($data['reason']), $audit, $notifications);
    }

    public function requestChanges(Request $request, PayoutMethod $payoutMethod, AuditLogService $audit, EventNotificationService $notifications): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        abort_unless($payoutMethod->user_id !== $request->user()->id, 403, 'Administrators cannot request changes to their own bank details.');

        return $this->decide($request, $payoutMethod, 'changes_requested', trim($data['reason']), $audit, $notifications);
    }

    public function resolveDuplicate(Request $request, PayoutMethod $payoutMethod, AuditLogService $audit, EventNotificationService $notifications): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        abort_unless($payoutMethod->user_id !== $request->user()->id, 403, 'Administrators cannot resolve payout details on their own account.');
        abort_unless($payoutMethod->account_fingerprint && $payoutMethod->duplicate_flagged_at, 422, 'This payout method has no unresolved matching-account review.');

        $methodIds = DB::transaction(function () use ($request, $payoutMethod, $data, $audit): array {
            $locked = PayoutMethod::query()->lockForUpdate()->findOrFail($payoutMethod->id);
            $matches = PayoutMethod::query()
                ->where('account_fingerprint', $locked->account_fingerprint)
                ->whereNotNull('duplicate_flagged_at')
                ->whereNull('duplicate_resolved_at')
                ->lockForUpdate()
                ->get();
            $ids = [];
            foreach ($matches as $match) {
                $fromStatus = $match->verification_status;
                $match->forceFill([
                    'duplicate_resolved_at' => now(),
                    'duplicate_resolved_by' => $request->user()->id,
                    'duplicate_resolution_note' => trim($data['reason']),
                ])->save();
                DB::table('payout_method_reviews')->insert([
                    'payout_method_id' => $match->id,
                    'actor_id' => $request->user()->id,
                    'action' => 'duplicate_review_resolved',
                    'from_status' => $fromStatus,
                    'to_status' => $match->verification_status,
                    'reason' => trim($data['reason']),
                    'metadata' => json_encode(['reviewed_match_count' => $matches->count()], JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $audit->record('payout_method.duplicate_review_resolved', $match, $request, after: [
                    'verification_status' => $match->verification_status,
                    'masked_account' => $match->maskedAccount(),
                    'duplicate_review_required' => false,
                ], actorId: $request->user()->id, reason: trim($data['reason']));
                $ids[] = $match->id;
            }

            return $ids;
        });

        foreach (PayoutMethod::query()->with('user')->whereIn('id', $methodIds)->get() as $method) {
            if ($method->user) {
                $notifications->notifyOnce($method->user, 'payout_verification.duplicate_resolved.'.$method->id, new EventNotification(
                    'Payout information reviewed',
                    'An administrator completed the review of your payout information. Check your payout settings for the current approval status.',
                    'info',
                    ['event_key' => 'payout_verification.duplicate_resolved', 'masked_account' => $method->maskedAccount()],
                ), $method->getAttribute('demo_batch_id'));
            }
        }

        return $this->ok(['resolved_method_ids' => $methodIds, 'count' => count($methodIds)]);
    }

    private function decide(Request $request, PayoutMethod $payoutMethod, string $status, ?string $reason, AuditLogService $audit, EventNotificationService $notifications): JsonResponse
    {
        $result = DB::transaction(function () use ($request, $payoutMethod, $status, $reason, $audit): array {
            $method = PayoutMethod::query()->with('user')->lockForUpdate()->findOrFail($payoutMethod->id);
            if ($method->verification_status === $status) {
                return ['method' => $method, 'review_id' => null, 'changed' => false];
            }
            if ($method->verification_status !== 'pending_review') {
                throw ValidationException::withMessages(['status' => 'Only bank details awaiting review can receive a new decision.']);
            }
            if ($method->status === 'deleted') {
                throw ValidationException::withMessages(['status' => 'Deleted bank details cannot be approved.']);
            }

            $beforeStatus = $method->verification_status ?: 'pending_review';
            if ($status === 'approved' && $method->user_id) {
                PayoutMethod::query()->where('user_id', $method->user_id)->where('id', '!=', $method->id)->update(['is_default' => false]);
            }
            $method->forceFill([
                'verification_status' => $status,
                'verification_reviewed_at' => now(),
                'verification_reviewed_by' => $request->user()->id,
                'verification_reason' => $reason,
                'status' => $status === 'approved' ? 'active' : ($method->status === 'pending_review' ? 'inactive' : $method->status),
                'is_default' => $status === 'approved',
            ])->save();
            $reviewId = DB::table('payout_method_reviews')->insertGetId([
                'payout_method_id' => $method->id,
                'actor_id' => $request->user()->id,
                'action' => $status,
                'from_status' => $beforeStatus,
                'to_status' => $status,
                'reason' => $reason,
                'metadata' => json_encode(['masked_account' => $method->maskedAccount()], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $audit->record('payout_method.'.$status, $method, $request, before: [
                'verification_status' => $beforeStatus,
                'masked_account' => $method->maskedAccount(),
            ], after: [
                'verification_status' => $status,
                'masked_account' => $method->maskedAccount(),
            ], actorId: $request->user()->id, reason: $reason);

            return ['method' => $method->fresh('user'), 'review_id' => $reviewId, 'changed' => true];
        });

        if ($result['changed'] && $result['method']->user) {
            $method = $result['method'];
            $title = match ($status) {
                'approved' => 'Bank account approved',
                'changes_requested' => 'Bank account changes requested',
                default => 'Bank account not approved',
            };
            $body = match ($status) {
                'approved' => 'Your bank account details were approved. You can now reserve eligible tasks.',
                'changes_requested' => 'An administrator requested changes to your bank account details. Review the note in your payout settings.',
                default => 'Your bank account details were not approved. Review the administrator’s note in your payout settings.',
            };
            $notifications->notifyOnce($method->user, 'payout_verification.'.$status.'.'.$result['review_id'], new EventNotification(
                $title,
                $body,
                $status === 'approved' ? 'success' : ($status === 'rejected' ? 'error' : 'warning'),
                ['event_key' => 'payout_verification.'.$status, 'masked_account' => $method->maskedAccount(), 'reason' => $reason],
            ), $method->getAttribute('demo_batch_id'));
        }

        return $this->ok($this->summaryPayload($result['method']));
    }

    private function summaryPayload(PayoutMethod $method): array
    {
        $method->loadMissing(['user', 'verifier']);

        return [
            'id' => $method->id,
            'member' => $method->user?->name,
            'email' => $method->user?->email,
            'user_id' => $method->user_id,
            'account_holder_name' => $method->account_holder_name,
            'entity_type' => $method->entity_type,
            'transfer_method' => $method->transfer_method,
            'country' => $method->country,
            'currency' => $method->currency,
            'masked_account' => $method->maskedAccount(),
            'status' => $method->verification_status ?: 'pending_review',
            'verification_reason' => $method->verification_reason,
            'submitted_at' => $method->verification_submitted_at?->toISOString(),
            'reviewed_at' => $method->verification_reviewed_at?->toISOString(),
            'reviewed_by' => $method->verifier?->name,
            'duplicate_review_required' => $method->duplicate_flagged_at !== null && $method->duplicate_resolved_at === null,
            'duplicate_resolution_note' => $method->duplicate_resolution_note,
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function duplicateMatches(PayoutMethod $method): array
    {
        if (! $method->account_fingerprint) {
            return [];
        }

        return PayoutMethod::query()
            ->with('user')
            ->where('account_fingerprint', $method->account_fingerprint)
            ->where('id', '!=', $method->id)
            ->where('status', '!=', 'deleted')
            ->get()
            ->map(fn (PayoutMethod $match): array => [
                'id' => $match->id,
                'user_id' => $match->user_id,
                'member' => $match->user?->name,
                'email' => $match->user?->email,
                'masked_account' => $match->maskedAccount(),
                'status' => $match->verification_status,
                'submitted_at' => $match->verification_submitted_at?->toISOString(),
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function history(PayoutMethod $method): array
    {
        return DB::table('payout_method_reviews as reviews')
            ->leftJoin('users as actors', 'actors.id', '=', 'reviews.actor_id')
            ->where('reviews.payout_method_id', $method->id)
            ->latest('reviews.id')
            ->get([
                'reviews.id', 'reviews.action', 'reviews.from_status', 'reviews.to_status', 'reviews.reason',
                'reviews.metadata', 'reviews.created_at', 'actors.name as actor',
            ])
            ->map(fn (object $review): array => [
                'id' => $review->id,
                'action' => $review->action,
                'from_status' => $review->from_status,
                'to_status' => $review->to_status,
                'reason' => $review->reason,
                'metadata' => is_string($review->metadata) ? json_decode($review->metadata, true) : $review->metadata,
                'actor' => $review->actor,
                'created_at' => $review->created_at,
            ])
            ->all();
    }
}
