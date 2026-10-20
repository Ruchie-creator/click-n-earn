<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\FaqEntry;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FaqController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = FaqEntry::query();
        if ($request->filled('search')) {
            $search = trim($request->string('search')->toString());
            $query->where(fn ($builder) => $builder->where('question', 'ilike', '%'.$search.'%')->orWhere('answer', 'ilike', '%'.$search.'%')->orWhere('category', 'ilike', '%'.$search.'%'));
        }
        if ($request->filled('published')) {
            $query->where('is_published', $request->boolean('published'));
        }

        return $this->ok($query->orderBy('sort_order')->orderBy('id')->get()->map(fn (FaqEntry $faq): array => $this->payload($faq))->values());
    }

    public function store(Request $request, AuditLogService $audit): JsonResponse
    {
        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;
        $faq = FaqEntry::create($data);
        $audit->record('faq.created', $faq, $request, after: $faq->only(['category', 'question', 'is_published', 'sort_order']), actorId: $request->user()->id);

        return $this->ok($this->payload($faq), 201);
    }

    public function update(Request $request, FaqEntry $faq, AuditLogService $audit): JsonResponse
    {
        $data = $this->validated($request, false);
        $before = $faq->only(['category', 'question', 'is_published', 'sort_order']);
        $faq->update($data);
        $audit->record('faq.updated', $faq, $request, before: $before, after: $faq->fresh()->only(['category', 'question', 'is_published', 'sort_order']), actorId: $request->user()->id);

        return $this->ok($this->payload($faq->fresh()));
    }

    public function destroy(Request $request, FaqEntry $faq, AuditLogService $audit): JsonResponse
    {
        $before = $faq->only(['category', 'question', 'is_published', 'sort_order']);
        $audit->record('faq.deleted', $faq, $request, before: $before, actorId: $request->user()->id);
        $faq->delete();

        return $this->ok(['deleted' => true]);
    }

    private function validated(Request $request, bool $required = true): array
    {
        $data = $request->validate([
            'category' => ['nullable', 'string', 'max:80'],
            'question' => [$required ? 'required' : 'sometimes', 'string', 'max:240'],
            'answer' => [$required ? 'required' : 'sometimes', 'string', 'max:10000'],
            'is_published' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:100000'],
        ]);
        foreach (['question', 'answer', 'category'] as $field) {
            if (isset($data[$field])) {
                $data[$field] = trim($data[$field]);
            }
        }

        return $data;
    }

    /** @return array<string, mixed> */
    private function payload(FaqEntry $faq): array
    {
        return [
            'id' => $faq->id,
            'category' => $faq->category,
            'question' => $faq->question,
            'answer' => $faq->answer,
            'is_published' => $faq->is_published,
            'sort_order' => $faq->sort_order,
            'updated_at' => $faq->updated_at?->toISOString(),
        ];
    }
}
