<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\Task;
use App\Models\TaskCategory;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TaskCategoryController extends ApiController
{
    public function index(): JsonResponse
    {
        return $this->ok(TaskCategory::query()->withCount('tasks')->orderBy('name')->get()->map(fn (TaskCategory $category): array => $this->payload($category))->values());
    }

    public function store(Request $request, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);
        $name = trim($data['name']);
        $category = DB::transaction(function () use ($name, $request, $audit): TaskCategory {
            $this->assertUniqueName($name);
            $category = TaskCategory::create(['name' => $name, 'slug' => $this->uniqueSlug($name), 'is_active' => true]);
            $audit->record('task_category.created', $category, $request, after: ['name' => $category->name, 'slug' => $category->slug], actorId: $request->user()->id);

            return $category;
        });

        return $this->ok($this->payload($category->loadCount('tasks')), 201);
    }

    public function update(Request $request, TaskCategory $category, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
            'archived' => ['sometimes', 'boolean'],
        ]);
        $updated = DB::transaction(function () use ($data, $category, $request, $audit): TaskCategory {
            $locked = TaskCategory::query()->lockForUpdate()->findOrFail($category->id);
            $before = ['name' => $locked->name, 'slug' => $locked->slug, 'is_active' => $locked->is_active];
            if (array_key_exists('name', $data)) {
                $name = trim($data['name']);
                $this->assertUniqueName($name, $locked->id);
                $locked->name = $name;
                $locked->slug = $this->uniqueSlug($name, $locked->id);
                Task::query()->where('category_id', $locked->id)->update(['category' => $name]);
            }
            if (array_key_exists('is_active', $data)) {
                $locked->is_active = $data['is_active'];
                $locked->archived_at = $data['is_active'] ? null : now();
            }
            if (array_key_exists('archived', $data)) {
                $locked->is_active = ! $data['archived'];
                $locked->archived_at = $data['archived'] ? now() : null;
            }
            $locked->save();
            $audit->record('task_category.updated', $locked, $request, before: $before, after: ['name' => $locked->name, 'slug' => $locked->slug, 'is_active' => $locked->is_active], actorId: $request->user()->id);

            return $locked->loadCount('tasks');
        });

        return $this->ok($this->payload($updated));
    }

    public function destroy(Request $request, TaskCategory $category, AuditLogService $audit): JsonResponse
    {
        $result = DB::transaction(function () use ($category, $request, $audit): array {
            $locked = TaskCategory::query()->lockForUpdate()->findOrFail($category->id);
            $taskCount = Task::where('category_id', $locked->id)->count();
            if ($taskCount > 0) {
                $locked->forceFill(['is_active' => false, 'archived_at' => now()])->save();
                $audit->record('task_category.archived', $locked, $request, after: ['name' => $locked->name, 'task_count' => $taskCount], actorId: $request->user()->id);

                return ['archived' => true, 'task_count' => $taskCount];
            }

            $audit->record('task_category.deleted', $locked, $request, before: ['name' => $locked->name], actorId: $request->user()->id);
            $locked->delete();

            return ['archived' => false, 'task_count' => 0];
        });

        return $this->ok($result);
    }

    private function assertUniqueName(string $name, ?int $except = null): void
    {
        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Enter a category name.']);
        }
        $query = TaskCategory::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)]);
        if ($except) {
            $query->where('id', '!=', $except);
        }
        if ($query->exists()) {
            throw ValidationException::withMessages(['name' => 'A category with this name already exists.']);
        }
    }

    private function uniqueSlug(string $name, ?int $except = null): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $suffix = 2;
        while (TaskCategory::query()->where('slug', $slug)->when($except, fn ($query) => $query->where('id', '!=', $except))->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }

    /** @return array<string, mixed> */
    private function payload(TaskCategory $category): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'is_active' => $category->is_active,
            'archived_at' => $category->archived_at?->toISOString(),
            'task_count' => $category->tasks_count ?? $category->tasks()->count(),
        ];
    }
}
