<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\Referral;
use Illuminate\Http\JsonResponse;

class ReferralController extends ApiController
{
    public function index(): JsonResponse
    {
        $items = Referral::with(['referrer', 'referredUser'])->latest()->paginate(30);

        return $this->ok([
            'items' => $items->getCollection()->map(fn (Referral $referral): array => [
                'id' => $referral->id,
                'referrer' => $referral->referrer?->name,
                'referred_user' => $referral->referredUser?->name,
                'referral_code' => $referral->referral_code,
                'status' => $referral->qualified_at ? 'Successful' : 'Task in progress',
                'reward' => (float) $referral->reward_amount,
                'reward_status' => $referral->reward_status,
                'registered_at' => $referral->registered_at?->toISOString(),
                'qualified_at' => $referral->qualified_at?->toISOString(),
            ])->values(),
            'summary' => [
                'total' => Referral::count(),
                'qualified' => Referral::whereNotNull('qualified_at')->count(),
                'rewards_paid' => (float) Referral::where('reward_status', 'paid')->sum('reward_amount'),
            ],
            'meta' => ['current_page' => $items->currentPage(), 'last_page' => $items->lastPage(), 'total' => $items->total()],
        ]);
    }
}
