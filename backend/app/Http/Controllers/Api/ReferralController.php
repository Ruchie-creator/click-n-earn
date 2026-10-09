<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReferralController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $items = $user->referralsSent()->with('referredUser')->latest()->get()->map(fn ($referral): array => [
            'id' => $referral->id,
            'name' => $referral->referredUser?->name,
            'email' => $referral->referredUser?->email,
            'joined_at' => $referral->registered_at?->toISOString(),
            'qualified_at' => $referral->qualified_at?->toISOString(),
            'status' => $referral->qualified_at ? 'Successful' : 'Task in progress',
            'reward' => (float) $referral->reward_amount,
            'reward_status' => $referral->reward_status,
        ]);

        return $this->ok([
            'code' => $user->referral_code,
            'items' => $items,
            'qualified_count' => $items->where('status', 'Successful')->count(),
            'pending_count' => $items->where('status', '!=', 'Successful')->count(),
        ]);
    }
}
