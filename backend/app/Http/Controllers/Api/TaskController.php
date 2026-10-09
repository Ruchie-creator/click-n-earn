<?php

namespace App\Http\Controllers\Api;

use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Task::query()
            ->where('status', 'available')
            ->whereRaw('reserved_slots + completed_slots < available_slots')
            ->where(fn ($builder) => $builder->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($builder) => $builder->whereNull('expires_at')->orWhere('expires_at', '>', now()))
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
            'items' => $tasks->getCollection()->map(fn (Task $task): array => $this->taskPayload($task))->values(),
            'meta' => [
                'current_page' => $tasks->currentPage(),
                'last_page' => $tasks->lastPage(),
                'per_page' => $tasks->perPage(),
                'total' => $tasks->total(),
            ],
        ]);
    }

    public function show(Task $task): JsonResponse
    {
        abort_unless($task->isAcceptable(), 404);

        return $this->ok($this->taskPayload($task));
    }
}
