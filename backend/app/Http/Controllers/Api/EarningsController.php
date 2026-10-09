<?php

namespace App\Http\Controllers\Api;

use App\Services\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EarningsController extends ApiController
{
    public function index(Request $request, LedgerService $ledger): JsonResponse
    {
        $user = $request->user();
        $entries = $user->ledgerEntries()->with(['reservation.task', 'referral'])->latest()->paginate(30);

        return $this->ok([
            'totals' => $ledger->totals($user),
            'items' => $entries->getCollection()->map(fn ($entry): array => [
                'id' => $entry->id,
                'type' => $this->enumValue($entry->type),
                'amount' => (float) $entry->amount,
                'direction' => $this->enumValue($entry->direction),
                'status' => $this->enumValue($entry->status),
                'reference' => $entry->reference,
                'task' => $entry->reservation?->task?->title,
                'created_at' => $entry->created_at?->toISOString(),
            ])->values(),
            'meta' => ['current_page' => $entries->currentPage(), 'last_page' => $entries->lastPage(), 'total' => $entries->total()],
        ]);
    }
}
