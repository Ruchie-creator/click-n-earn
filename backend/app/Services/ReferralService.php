<?php

namespace App\Services;

use App\Models\Referral;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\EventNotification;
use Illuminate\Support\Facades\DB;

class ReferralService
{
    public function __construct(private readonly EventNotificationService $notifications)
    {
    }

    public function registerReferral(User $referredUser, ?string $code): ?Referral
    {
        if (blank($code)) {
            return null;
        }

        $referrer = User::query()->where('referral_code', strtoupper(trim($code)))->first();

        if (! $referrer || $referrer->is($referredUser)) {
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

        return (string) data_get($configured, 'amount', config('referrals.reward_amount', 12));
    }

    public function qualifyAfterApprovedTask(User $referredUser): ?Referral
    {
        return DB::transaction(function () use ($referredUser): ?Referral {
            $referral = Referral::query()
                ->with('referrer')
                ->where('referred_user_id', $referredUser->id)
                ->whereNull('qualified_at')
                ->lockForUpdate()
                ->first();

            if (! $referral) {
                return null;
            }

            $referral->forceFill([
                'qualified_at' => now(),
                'reward_status' => 'pending',
            ])->save();

            app(LedgerService::class)->issueReferralReward($referral);
            if ($referral->referrer) {
                $this->notifications->notifyOnce($referral->referrer, 'referral.qualified.'.$referral->id, new EventNotification(
                'Referral reward qualified',
                $referredUser->name.' completed their first approved task. A referral reward has been added to your earnings.',
                'success',
                ['referral_id' => $referral->id],
                ), $referral->getAttribute('demo_batch_id'));
            }

            return $referral->fresh();
        });
    }
}
