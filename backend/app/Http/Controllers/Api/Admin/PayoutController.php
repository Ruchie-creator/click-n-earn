<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Jobs\SyncPayoutJob;
use App\Models\Payout;
use App\Services\AuditLogService;
use App\Services\PayoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayoutController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Payout::with(['user', 'reservation.task', 'payoutMethod'])->latest();
        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }
        $payouts = $query->paginate(30);

        return $this->ok([
            'items' => $payouts->getCollection()->map(fn (Payout $payout): array => $this->adminPayload($payout))->values(),
            'meta' => ['current_page' => $payouts->currentPage(), 'last_page' => $payouts->lastPage(), 'total' => $payouts->total()],
        ]);
    }

    public function process(Request $request, Payout $payout, AuditLogService $audit): JsonResponse
    {
        ProcessPayoutJob::dispatchSync($payout->id);
        $audit->record('payout.processed', $payout, $request, after: $payout->fresh()->toArray(), actorId: $request->user()->id);

        return $this->ok($this->payoutPayload($payout->fresh()));
    }

    public function retry(Request $request, Payout $payout, PayoutService $service): JsonResponse
    {
        $service->retryFailed($payout, $request->user()->id);

        return $this->message('Payout queued for retry.');
    }

    public function sync(Payout $payout): JsonResponse
    {
        SyncPayoutJob::dispatchSync($payout->id);

        return $this->ok($this->payoutPayload($payout->fresh()));
    }

    public function manualPaid(Request $request, Payout $payout, PayoutService $service): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string', 'max:160'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        $result = $service->manualMarkPaid($payout, $data['reference'], $data['note'] ?? null, $request->user()->id);

        return $this->ok($this->payoutPayload($result));
    }

    public function markPaid(Request $request, Payout $payout, PayoutService $service): JsonResponse
    {
        return $this->manualPaid($request, $payout, $service);
    }

    private function adminPayload(Payout $payout): array
    {
        return array_merge($this->payoutPayload($payout), [
            'member' => $payout->user?->name,
            'email' => $payout->user?->email,
            'task' => $payout->reservation?->task?->title,
            'masked_account' => $payout->payoutMethod?->maskedAccount(),
        ]);
    }
}
