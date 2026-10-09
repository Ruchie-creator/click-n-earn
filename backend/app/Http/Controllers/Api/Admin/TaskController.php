<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\TaskStatus;
use App\Http\Controllers\Api\ApiController;
use App\Models\Task;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
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

        return $this->ok($this->taskPayload($task), 201);
    }

    public function update(Request $request, Task $task, AuditLogService $audit): JsonResponse
    {
        $data = $this->validated($request, false);
        $task = DB::transaction(function () use ($task, $data, $audit, $request): Task {
            $locked = Task::query()->lockForUpdate()->findOrFail($task->id);
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
            'category' => [$required ? 'required' : 'sometimes', 'string', 'max:80'],
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
}
