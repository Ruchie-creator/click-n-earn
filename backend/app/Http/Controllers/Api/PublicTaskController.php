<?php

namespace App\Http\Controllers\Api;

use App\Models\Task;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicTaskController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'string', 'max:120'],
            'sort' => ['sometimes', 'string', 'in:newest,highest_incentive,most_slots'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);
        $query = $this->availableTasks();

        if (! empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function (Builder $builder) use ($search): void {
                $builder->where('title', 'ilike', '%'.$search.'%')
                    ->orWhere('description', 'ilike', '%'.$search.'%');
            });
        }

        if (($validated['sort'] ?? 'newest') === 'highest_incentive') {
            $query->orderByDesc('incentive_amount');
        } elseif (($validated['sort'] ?? 'newest') === 'most_slots') {
            $query->orderByRaw('(available_slots - reserved_slots - completed_slots) DESC');
        } else {
            $query->latest();
        }

        $tasks = $query->paginate($validated['per_page'] ?? 12);

        return $this->ok([
            'items' => $tasks->getCollection()->map(fn (Task $task): array => $this->publicTaskPayload($task))->values(),
            'meta' => [
                'current_page' => $tasks->currentPage(),
                'last_page' => $tasks->lastPage(),
                'per_page' => $tasks->perPage(),
                'total' => $tasks->total(),
            ],
        ]);
    }

    public function show(string $task): JsonResponse
    {
        $task = $this->availableTasks()->where('slug', $task)->firstOrFail();

        return $this->ok($this->publicTaskPayload($task));
    }

    /** @return Builder<Task> */
    private function availableTasks(): Builder
    {
        return Task::query()->availableForDiscovery();
    }

    /**
     * @return array<string, int|float|string|null>
     */
    private function publicTaskPayload(Task $task): array
    {
        return [
            'id' => $task->id,
            'slug' => $task->slug,
            'title' => $task->title,
            'short_description' => str($task->description)->limit(180)->toString(),
            'image' => $task->image_path,
            'reimbursement_amount' => (float) $task->reimbursement_amount,
            'incentive' => (float) $task->incentive_amount,
            'expected_payout' => (float) $task->expected_payout,
            'slots' => max(0, $task->available_slots - $task->reserved_slots - $task->completed_slots),
            'status' => 'available',
            'content' => $task->content ?: [],
        ];
    }
}
