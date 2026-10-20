<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\TaskStatus;
use App\Http\Controllers\Api\ApiController;
use App\Models\Task;
use App\Models\TaskCategory;
use App\Services\AuditLogService;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TaskController extends ApiController
{
    public function index(): JsonResponse
    {
        return $this->ok(Task::withCount('reservations')->latest()->get()->map(fn (Task $task): array => array_merge($this->taskPayload($task), [
            'reservation_count' => $task->reservations_count,
        ])));
    }

    public function store(Request $request, AuditLogService $audit): JsonResponse
    {
        $data = $this->validated($request);
        $task = DB::transaction(function () use ($data, $request, $audit): Task {
            $this->resolveCategory($data, true);
            $data['slug'] = $data['slug'] ?? Str::slug($data['title']).'-'.Str::lower(Str::random(5));
            $data['created_by'] = $request->user()->id;
            $data['status'] = $data['status'] ?? TaskStatus::AVAILABLE;
            $data['instructions'] = $data['instructions'] ?? [];
            $data['proof_requirements'] = $data['proof_requirements'] ?? [];
            $data['expected_payout'] = Money::add($data['reimbursement_amount'], $data['incentive_amount']);
            $task = Task::create($data);
            if ($batchId = $request->user()->getAttribute('demo_batch_id')) {
                $task->forceFill([
                    'demo_batch_id' => $batchId,
                    'demo_key' => 'admin-task-'.$task->id,
                ])->save();
            }
            $audit->record('task.created', $task, $request, after: $task->toArray(), actorId: $request->user()->id);

            return $task;
        });

        return $this->ok($this->taskPayload($task), 201);
    }

    public function update(Request $request, Task $task, AuditLogService $audit): JsonResponse
    {
        $data = $this->validated($request, false);
        $task = DB::transaction(function () use ($task, $data, $audit, $request): Task {
            $locked = Task::query()->lockForUpdate()->findOrFail($task->id);
            $this->resolveCategory($data, false);
            if (isset($data['available_slots']) && $data['available_slots'] < $locked->reserved_slots + $locked->completed_slots) {
                throw ValidationException::withMessages([
                    'available_slots' => 'Available slots cannot be lower than the reserved and completed task count.',
                ]);
            }
            $before = $locked->toArray();
            if (isset($data['reimbursement_amount']) || isset($data['incentive_amount'])) {
                $data['expected_payout'] = Money::add(
                    (string) ($data['reimbursement_amount'] ?? $locked->reimbursement_amount),
                    (string) ($data['incentive_amount'] ?? $locked->incentive_amount),
                );
            }
            $locked->update($data);
            $audit->record('task.updated', $locked, $request, before: $before, after: $locked->fresh()->toArray(), actorId: $request->user()->id);

            return $locked->fresh();
        });

        return $this->ok($this->taskPayload($task));
    }

    public function changeStatus(Request $request, Task $task, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'string', 'in:available,paused,expired,archived']]);
        $before = $task->toArray();
        $task->update(['status' => $data['status']]);
        $audit->record('task.status_changed', $task, $request, before: $before, after: $task->fresh()->toArray(), actorId: $request->user()->id);

        return $this->ok($this->taskPayload($task->fresh()));
    }

    public function publish(Request $request, Task $task, AuditLogService $audit): JsonResponse
    {
        $task->update(['status' => TaskStatus::AVAILABLE]);
        $audit->record('task.published', $task, $request, after: $task->fresh()->toArray(), actorId: $request->user()->id);

        return $this->ok($this->taskPayload($task->fresh()));
    }

    public function pause(Request $request, Task $task, AuditLogService $audit): JsonResponse
    {
        $task->update(['status' => TaskStatus::PAUSED]);
        $audit->record('task.paused', $task, $request, after: $task->fresh()->toArray(), actorId: $request->user()->id);

        return $this->ok($this->taskPayload($task->fresh()));
    }

    private function validated(Request $request, bool $required = true): array
    {
        return $request->validate([
            'title' => [$required ? 'required' : 'sometimes', 'string', 'max:180'],
            'slug' => ['sometimes', 'string', 'max:200'],
            'description' => [$required ? 'required' : 'sometimes', 'string'],
            'category' => [$required ? 'required_without:category_id' : 'sometimes', 'nullable', 'string', 'max:80'],
            'category_id' => [$required ? 'required_without:category' : 'sometimes', 'nullable', 'integer', 'exists:task_categories,id'],
            'image_path' => ['nullable', 'string', 'max:500'],
            'external_checkout_url' => ['nullable', 'url', 'max:500'],
            'reimbursement_amount' => [$required ? 'required' : 'sometimes', 'numeric', 'min:0.01'],
            'incentive_amount' => [$required ? 'required' : 'sometimes', 'numeric', 'min:0'],
            'available_slots' => [$required ? 'required' : 'sometimes', 'integer', 'min:1'],
            'instructions' => ['nullable', 'array'],
            'proof_requirements' => ['nullable', 'array'],
            'status' => ['sometimes', 'string', 'in:available,paused,expired,archived'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
        ]);
    }

    /** @param array<string, mixed> $data */
    private function resolveCategory(array &$data, bool $required): void
    {
        if (array_key_exists('category_id', $data) && $data['category_id'] !== null) {
            $category = TaskCategory::query()->where('is_active', true)->find($data['category_id']);
            if (! $category) {
                throw ValidationException::withMessages(['category_id' => 'Choose an active task category.']);
            }
            $data['category_id'] = $category->id;
            $data['category'] = $category->name;

            return;
        }
        if (array_key_exists('category', $data) && trim((string) $data['category']) !== '') {
            $name = trim((string) $data['category']);
            $category = TaskCategory::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();
            if ($category && ! $category->is_active) {
                $category->forceFill(['is_active' => true, 'archived_at' => null])->save();
            }
            $category ??= TaskCategory::create(['name' => $name, 'slug' => $this->categorySlug($name), 'is_active' => true]);
            $data['category_id'] = $category->id;
            $data['category'] = $category->name;

            return;
        }
        if ($required) {
            throw ValidationException::withMessages(['category_id' => 'Choose or add a task category.']);
        }
        unset($data['category_id']);
        if (array_key_exists('category', $data)) {
            unset($data['category']);
        }
    }

    private function categorySlug(string $name): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $suffix = 2;
        while (TaskCategory::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }
}
