<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\AuditLog;
use App\Models\LedgerEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $entries = LedgerEntry::with(['user', 'reservation.task', 'payout'])->latest()->paginate(50);

        return $this->ok([
            'items' => $entries->getCollection()->map(fn (LedgerEntry $entry): array => [
                'id' => $entry->id,
                'reference' => $entry->reference,
                'member' => $entry->user?->name,
                'type' => $this->enumValue($entry->type),
                'amount' => (float) $entry->amount,
                'direction' => $this->enumValue($entry->direction),
                'status' => $this->enumValue($entry->status),
                'task' => $entry->reservation?->task?->title,
                'payout_id' => $entry->payout_id,
                'created_at' => $entry->created_at?->toISOString(),
            ])->values(),
            'meta' => ['current_page' => $entries->currentPage(), 'last_page' => $entries->lastPage(), 'total' => $entries->total()],
        ]);
    }

    public function audit(Request $request): JsonResponse
    {
        $logs = AuditLog::with('actor')->latest()->paginate(50);

        return $this->ok([
            'items' => $logs->getCollection()->map(fn (AuditLog $log): array => [
                'id' => $log->id,
                'action' => $log->action,
                'actor' => $log->actor?->name,
                'subject_type' => $log->subject_type,
                'subject_id' => $log->subject_id,
                'created_at' => $log->created_at?->toISOString(),
            ])->values(),
            'meta' => ['current_page' => $logs->currentPage(), 'last_page' => $logs->lastPage(), 'total' => $logs->total()],
        ]);
    }
}
