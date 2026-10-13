<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Jobs\ProcessPayoutJob;
use App\Jobs\SyncPayoutJob;
use App\Models\Payout;
use App\Services\AirwallexEnvironment;
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

    public function process(Request $request, Payout $payout, AuditLogService $audit, AirwallexEnvironment $environments): JsonResponse
    {
        abort_unless($payout->status->value === 'approved', 422, 'Only approved payouts can be released.');
        if ($payout->provider_environment === 'live') {
            $data = $request->validate(['confirmation' => ['required', 'in:LIVE']]);
            unset($data);
        }
        abort_if($payout->getAttribute('demo_batch_id') && $payout->provider_environment === 'live', 422, 'Demo payouts cannot be released in Live Airwallex mode.');
        abort_unless($payout->provider_environment === $environments->active(), 422, 'This payout belongs to a different Airwallex environment and cannot be released from the active queue.');
        $hasActiveMethod = $payout->payoutMethod?->status === 'active'
            || $payout->user?->payoutMethods()->where('status', 'active')->exists();
        abort_unless($hasActiveMethod, 422, 'The member must add an active payout method before this payout can be released.');
        ProcessPayoutJob::dispatch($payout->id)->afterCommit();
        $audit->record('payout.release_requested', $payout, $request, after: ['provider' => 'airwallex', 'provider_environment' => $payout->provider_environment], actorId: $request->user()->id);

        return $this->message('Payout queued for Airwallex processing.');
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

    private function adminPayload(Payout $payout): array
    {
        return array_merge($this->payoutPayload($payout), [
            'member' => $payout->user?->name,
            'email' => $payout->user?->email,
            'task' => $payout->reservation?->task?->title,
            'masked_account' => $payout->payoutMethod?->maskedAccount(),
            'provider_environment' => $payout->provider_environment,
            'provider_request_id' => $payout->provider_request_id,
        ]);
    }
}
