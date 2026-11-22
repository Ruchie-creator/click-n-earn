<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\TaskStatus;
use App\Http\Controllers\Api\ApiController;
use App\Models\Task;
use App\Services\AuditLogService;
use App\Support\Money;
use Carbon\CarbonImmutable;
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

    public function show(Task $task): JsonResponse
    {
        $task->load(['reservations' => fn ($query) => $query
            ->with(['user:id,name,email', 'latestProofSubmission:id,task_reservation_id,status,submitted_at'])
            ->latest('reserved_at')]);

        $reservations = $task->reservations;
        $submitted = $reservations->whereNotNull('submitted_at');
        $approvedStatuses = ['approved', 'processing', 'paid'];
        $approved = $reservations->filter(fn ($reservation): bool => in_array($this->enumValue($reservation->status), $approvedStatuses, true));
        $paid = $reservations->filter(fn ($reservation): bool => $this->enumValue($reservation->status) === 'paid');
        $start = CarbonImmutable::today()->subDays(13);
        $trend = collect(range(0, 13))->map(function (int $offset) use ($reservations, $start): array {
            $date = $start->addDays($offset);

            return [
                'date' => $date->toDateString(),
                'reservations' => $reservations->filter(fn ($reservation): bool => $reservation->reserved_at?->isSameDay($date) ?? false)->count(),
                'submissions' => $reservations->filter(fn ($reservation): bool => $reservation->submitted_at?->isSameDay($date) ?? false)->count(),
            ];
        })->values();

        return $this->ok([
            'task' => $this->taskPayload($task),
            'metrics' => [
                'reservations' => $reservations->count(),
                'submissions' => $submitted->count(),
                'approved' => $approved->count(),
                'paid' => $paid->count(),
                'submission_rate' => $reservations->count() > 0 ? round(($submitted->count() / $reservations->count()) * 100, 1) : 0,
                'approval_rate' => $submitted->count() > 0 ? round(($approved->count() / $submitted->count()) * 100, 1) : 0,
                'committed_value' => round((float) $reservations->sum('expected_payout'), 2),
                'paid_value' => round((float) $paid->sum('expected_payout'), 2),
            ],
            'funnel' => [
                ['label' => 'Reserved', 'value' => $reservations->count()],
                ['label' => 'Proof submitted', 'value' => $submitted->count()],
                ['label' => 'Approved', 'value' => $approved->count()],
                ['label' => 'Paid', 'value' => $paid->count()],
            ],
            'trend' => $trend,
            'recent_activity' => $reservations->take(8)->map(fn ($reservation): array => [
                'id' => $reservation->id,
                'member' => $reservation->user?->name ?? 'Member',
                'email' => $reservation->user?->email,
                'status' => $this->enumValue($reservation->status),
                'amount' => (float) $reservation->expected_payout,
                'reserved_at' => $reservation->reserved_at?->toISOString(),
                'submitted_at' => $reservation->submitted_at?->toISOString(),
            ])->values(),
        ]);
    }

    public function store(Request $request, AuditLogService $audit): JsonResponse
    {
        $data = $this->validated($request);
        $task = DB::transaction(function () use ($data, $request, $audit): Task {
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

    public function destroy(Request $request, Task $task, AuditLogService $audit): JsonResponse
    {
        DB::transaction(function () use ($request, $task, $audit): void {
            $locked = Task::query()->lockForUpdate()->withCount('reservations')->findOrFail($task->id);
            if ($locked->reservations_count > 0) {
                throw ValidationException::withMessages(['task' => 'Tasks with reservations cannot be deleted. Pause or archive the task instead to preserve financial records.']);
            }
            $before = $locked->toArray();
            $audit->record('task.deleted', $locked, $request, before: $before, actorId: $request->user()->id);
            $locked->delete();
        });

        return $this->ok(['deleted' => true]);
    }

    public function forceDestroy(Request $request, Task $task, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate([
            'confirmation' => ['required', 'string'],
        ]);
        if (! hash_equals($task->title, $data['confirmation'])) {
            throw ValidationException::withMessages([
                'confirmation' => 'Enter the exact task title to confirm permanent deletion.',
            ]);
        }

        DB::transaction(function () use ($request, $task, $audit): void {
            $locked = Task::query()->lockForUpdate()->withCount('reservations')->findOrFail($task->id);
            $before = $locked->toArray();
            $before['reservations_deleted'] = $locked->reservations_count;
            $audit->record('task.force_deleted', $locked, $request, before: $before, actorId: $request->user()->id);
            $locked->delete();
        });

        return $this->ok(['deleted' => true]);
    }

    private function validated(Request $request, bool $required = true): array
    {
        $data = $request->validate([
            'title' => [$required ? 'required' : 'sometimes', 'string', 'max:180'],
            'slug' => ['sometimes', 'string', 'max:200'],
            'description' => [$required ? 'required' : 'sometimes', 'string'],
            // Categories are legacy metadata only. New tasks do not require one;
            // accepting the fields keeps older clients/data compatible without
            // creating or activating category records.
            'category' => ['sometimes', 'nullable', 'string', 'max:80'],
            'category_id' => ['sometimes', 'nullable', 'integer', 'exists:task_categories,id'],
            'image_path' => ['nullable', 'string', 'max:500'],
            'external_checkout_url' => ['nullable', 'url', 'max:500'],
            'reimbursement_amount' => [$required ? 'required' : 'sometimes', 'numeric', 'min:0.01'],
            'incentive_amount' => [$required ? 'required' : 'sometimes', 'numeric', 'min:0'],
            'available_slots' => [$required ? 'required' : 'sometimes', 'integer', 'min:1'],
            'instructions' => ['nullable', 'array'],
            'proof_requirements' => ['nullable', 'array'],
            'content' => ['sometimes', 'nullable', 'array'],
            'content.overview_html' => ['nullable', 'string', 'max:50000'],
            'content.terms_html' => ['nullable', 'string', 'max:50000'],
            'content.verification_time' => ['nullable', 'string', 'max:120'],
            'content.upload_guidance' => ['nullable', 'string', 'max:5000'],
            'content.steps' => ['nullable', 'array', 'max:100'],
            'content.steps.*' => ['array'],
            'content.steps.*.id' => ['nullable', 'string', 'max:100'],
            'content.steps.*.title' => ['nullable', 'string', 'max:180'],
            'content.steps.*.body' => ['nullable', 'string', 'max:20000'],
            'content.dos' => ['nullable', 'array', 'max:100'],
            'content.dos.*' => ['array'],
            'content.dos.*.id' => ['nullable', 'string', 'max:100'],
            'content.dos.*.title' => ['nullable', 'string', 'max:180'],
            'content.dos.*.body' => ['nullable', 'string', 'max:10000'],
            'content.donts' => ['nullable', 'array', 'max:100'],
            'content.donts.*' => ['array'],
            'content.donts.*.id' => ['nullable', 'string', 'max:100'],
            'content.donts.*.title' => ['nullable', 'string', 'max:180'],
            'content.donts.*.body' => ['nullable', 'string', 'max:10000'],
            'content.faqs' => ['nullable', 'array', 'max:100'],
            'content.faqs.*' => ['array'],
            'content.faqs.*.id' => ['nullable', 'string', 'max:100'],
            'content.faqs.*.question' => ['nullable', 'string', 'max:500'],
            'content.faqs.*.answer' => ['nullable', 'string', 'max:20000'],
            'status' => ['sometimes', 'string', 'in:available,paused,expired,archived'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
        ]);

        if (array_key_exists('content', $data)) {
            $data['content'] = $this->normalizeContent($data['content']);
        }

        return $data;
    }

    /**
     * Keep the structured editor payload predictable and safe for rendering.
     * This is deliberately additive; legacy description/instructions are not
     * rewritten or interpreted here.
     */
    private function normalizeContent(?array $content): ?array
    {
        if ($content === null) {
            return null;
        }

        return [
            'overview_html' => $this->safeRichText($content['overview_html'] ?? null),
            'terms_html' => $this->safeRichText($content['terms_html'] ?? null),
            'verification_time' => $this->plainText($content['verification_time'] ?? null, 120),
            'upload_guidance' => $this->safeRichText($content['upload_guidance'] ?? null),
            'steps' => $this->normalizeEntries($content['steps'] ?? [], 'body'),
            'dos' => $this->normalizeEntries($content['dos'] ?? [], 'body'),
            'donts' => $this->normalizeEntries($content['donts'] ?? [], 'body'),
            'faqs' => $this->normalizeEntries($content['faqs'] ?? [], 'answer', 'question'),
        ];
    }

    /** @return array<int, array<string, string>> */
    private function normalizeEntries(array $entries, string $bodyKey, string $titleKey = 'title'): array
    {
        $normalized = [];

        foreach ($entries as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $title = $this->plainText($entry[$titleKey] ?? null, 500);
            $body = $this->safeRichText($entry[$bodyKey] ?? null);
            if ($title === null && $body === null) {
                continue;
            }

            $normalized[] = [
                'id' => $this->plainText($entry['id'] ?? null, 100) ?: Str::uuid()->toString(),
                $titleKey => $title ?? '',
                $bodyKey => $body ?? '',
            ];
        }

        return $normalized;
    }

    private function plainText(mixed $value, int $maxLength): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim(strip_tags((string) $value));

        return $value === '' ? null : mb_substr($value, 0, $maxLength);
    }

    private function safeRichText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $clean = strip_tags((string) $value, '<p><br><strong><em><u><ol><ul><li><h1><h2><h3><blockquote>');
        // Allowed tags are intentionally attribute-free: no javascript URLs,
        // event handlers, inline CSS, or embedded content can survive.
        $clean = preg_replace('/<([a-z0-9]+)(?:\s[^>]*)?>/i', '<$1>', $clean) ?? '';
        $clean = trim($clean);

        return $clean === '' ? null : $clean;
    }
}
