<?php

namespace App\Services;

use App\Models\Referral;
use App\Models\Setting;
use App\Models\TaskReservation;
use App\Models\User;
use App\Notifications\EventNotification;
use Illuminate\Support\Facades\DB;

class ReferralService
{
    public function __construct(private readonly EventNotificationService $notifications) {}

    public function registerReferral(User $referredUser, ?string $code): ?Referral
    {
        if (blank($code)) {
            return null;
        }

        $referrer = User::query()->where('referral_code', strtoupper(trim($code)))->first();

        if (! $referrer || $referrer->is($referredUser) || mb_strtolower($referrer->email) === mb_strtolower($referredUser->email)) {
            return null;
        }

        $referrerBatchId = $referrer->getAttribute('demo_batch_id');
        $referredBatchId = $referredUser->getAttribute('demo_batch_id');
        if ($referrerBatchId && $referredBatchId && $referrerBatchId !== $referredBatchId) {
            throw new \LogicException('A referral cannot connect separate demo batches.');
        }

        $referral = Referral::firstOrCreate(
            ['referred_user_id' => $referredUser->id],
            [
                'referrer_id' => $referrer->id,
                'referral_code' => $referrer->referral_code,
                'registered_at' => now(),
                'reward_amount' => $this->rewardAmount(),
                'reward_status' => 'pending',
            ],
        );

        $demoBatchId = $referrerBatchId ?: $referredBatchId;
        if ($demoBatchId) {
            $referral->forceFill([
                'demo_batch_id' => $demoBatchId,
                'demo_key' => 'referral-user-'.$referredUser->id,
            ])->save();
        }

        return $referral;
    }

    private function rewardAmount(): string
    {
        $configured = Setting::query()->where('key', 'referrals.reward_amount')->first()?->value;
        $amount = data_get($configured, 'amount', config('referrals.reward_amount', 12));

        if (! is_numeric($amount) || (float) $amount < 0) {
            $amount = config('referrals.reward_amount', 12);
        }

        return number_format((float) $amount, 2, '.', '');
    }

    public function qualifyAfterApprovedTask(User $referredUser, TaskReservation $reservation): ?Referral
    {
        return DB::transaction(function () use ($referredUser, $reservation): ?Referral {
            $referral = Referral::query()
                ->with('referrer')
                ->where('referred_user_id', $referredUser->id)
                ->whereNull('qualified_at')
                ->lockForUpdate()
                ->first();

            if (! $referral) {
                return null;
            }

            $sharedPayoutDetails = $this->sharesApprovedPayoutIdentifier($referral);
            $referral->forceFill([
                'qualified_at' => now(),
                'qualifying_task_reservation_id' => $reservation->id,
                'reward_status' => 'pending_approval',
                'self_abuse_flagged_at' => $sharedPayoutDetails ? now() : null,
            ])->save();

            app(LedgerService::class)->issueReferralReward($referral);
            if ($referral->referrer) {
                $this->notifications->notifyOnce($referral->referrer, 'referral.qualified.'.$referral->id, new EventNotification(
                    'Referral reward qualified',
                    $referredUser->name.' completed their first approved task. Your referral reward is awaiting administrator approval.',
                    'info',
                    ['event_key' => 'referral.qualified', 'referral_id' => $referral->id, 'reward_amount' => $referral->reward_amount, 'currency' => config('payout.currency', 'USD')],
                ), $referral->getAttribute('demo_batch_id'));
            }
            $this->notifications->notifyAdmins('referral.pending_approval.'.$referral->id, new EventNotification(
                'Referral reward awaiting review',
                sprintf('Referral reward #%d qualified after its first approved task and is awaiting administrator review.', $referral->id),
                $sharedPayoutDetails ? 'warning' : 'info',
                [
                    'event_key' => 'referral.pending_approval',
                    'referral_id' => $referral->id,
                    'reward_amount' => $referral->reward_amount,
                    'member' => $referral->referrer?->name,
                    'possible_duplicate_account' => $sharedPayoutDetails,
                    'admin_notification' => true,
                ],
            ), $referral->getAttribute('demo_batch_id'));

            return $referral->fresh();
        });
    }

    private function sharesApprovedPayoutIdentifier(Referral $referral): bool
    {
        if (! $referral->referrer_id || ! $referral->referred_user_id) {
            return false;
        }

        $referrerFingerprints = $referral->referrer->payoutMethods()
            ->where('verification_status', 'approved')
            ->whereNotNull('account_fingerprint')
            ->pluck('account_fingerprint');

        return $referrerFingerprints->isNotEmpty() && $referral->referredUser->payoutMethods()
            ->where('verification_status', 'approved')
            ->whereIn('account_fingerprint', $referrerFingerprints)
            ->exists();
    }
}
