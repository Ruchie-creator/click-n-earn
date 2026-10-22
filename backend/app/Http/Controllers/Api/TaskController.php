<?php

namespace App\Http\Controllers\Api;

use App\Models\Task;
use App\Models\TaskCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $query = Task::query()
            ->withExists([
                'reservations as user_has_claimed_participation' => fn ($builder) => $builder->where('user_id', $userId)->whereNotNull('participation_claimed_at'),
                'reservations as user_has_active_reservation' => fn ($builder) => $builder->where('user_id', $userId)->whereIn('status', $this->activeReservationStatuses()),
            ])
            ->where(function ($builder) use ($userId): void {
                $builder->where(function ($available): void {
                    $available->where('status', 'available')
                        ->whereRaw('reserved_slots + completed_slots < available_slots')
                        ->where(fn ($dates) => $dates->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
                        ->where(fn ($dates) => $dates->whereNull('expires_at')->orWhere('expires_at', '>', now()));
                })->orWhereHas('reservations', fn ($reservations) => $reservations
                    ->where('user_id', $userId)
                    ->where(fn ($history) => $history->whereNotNull('participation_claimed_at')->orWhereIn('status', $this->activeReservationStatuses())));
            })
            ->orderByDesc('created_at');
        if ($request->filled('category') && $request->string('category')->toString() !== 'All') {
            $query->where('category', $request->string('category')->toString());
        }
        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(function ($builder) use ($search): void {
                $builder->where('title', 'ilike', '%'.$search.'%')
                    ->orWhere('description', 'ilike', '%'.$search.'%')
                    ->orWhere('category', 'ilike', '%'.$search.'%');
            });
        }
        if ($request->string('sort')->toString() === 'highest_incentive') {
            $query->orderByDesc('incentive_amount');
        } elseif ($request->string('sort')->toString() === 'most_slots') {
            $query->orderByRaw('(available_slots - reserved_slots - completed_slots) DESC');
        }

        $tasks = $query->paginate(max(1, min($request->integer('per_page', 12), 50)));

        return $this->ok([
            'items' => $tasks->getCollection()->map(fn (Task $task): array => $this->taskPayload($task, $this->availabilityStatus($task)))->values(),
            'meta' => [
                'current_page' => $tasks->currentPage(),
                'last_page' => $tasks->lastPage(),
                'per_page' => $tasks->perPage(),
                'total' => $tasks->total(),
                'categories' => TaskCategory::query()->where('is_active', true)->orderBy('name')->pluck('name')->values(),
            ],
        ]);
    }

    public function show(Task $task): JsonResponse
    {
        $userId = request()->user()->id;
        $task->loadExists([
            'reservations as user_has_claimed_participation' => fn ($builder) => $builder->where('user_id', $userId)->whereNotNull('participation_claimed_at'),
            'reservations as user_has_active_reservation' => fn ($builder) => $builder->where('user_id', $userId)->whereIn('status', $this->activeReservationStatuses()),
        ]);
        abort_unless($task->isAcceptable() || $task->user_has_claimed_participation || $task->user_has_active_reservation, 404);

        return $this->ok($this->taskPayload($task, $this->availabilityStatus($task)));
    }

    /** @return array<int, string> */
    private function activeReservationStatuses(): array
    {
        return ['reserved', 'proof_submitted', 'under_review', 'changes_requested', 'approved', 'processing', 'payout_failed'];
    }

    private function availabilityStatus(Task $task): string
    {
        if ($task->user_has_claimed_participation) {
            return 'purchased';
        }

        return $task->isAcceptable() && ! $task->user_has_active_reservation ? 'available' : 'unavailable';
    }
}
