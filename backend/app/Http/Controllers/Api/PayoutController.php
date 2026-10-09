<?php

namespace App\Http\Controllers\Api;

use App\Models\Payout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayoutController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $payouts = $request->user()->payouts()->latest()->paginate(20);

        return $this->ok([
            'items' => $payouts->getCollection()->map(fn (Payout $payout): array => $this->payoutPayload($payout))->values(),
            'meta' => ['current_page' => $payouts->currentPage(), 'last_page' => $payouts->lastPage(), 'total' => $payouts->total()],
        ]);
    }

    public function show(Request $request, Payout $payout): JsonResponse
    {
        abort_unless($payout->user_id === $request->user()->id, 404);

        return $this->ok($this->payoutPayload($payout));
    }
}
