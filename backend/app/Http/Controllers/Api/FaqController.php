<?php

namespace App\Http\Controllers\Api;

use App\Models\FaqEntry;
use Illuminate\Http\JsonResponse;

class FaqController extends ApiController
{
    public function index(): JsonResponse
    {
        return $this->ok(FaqEntry::query()->where('is_published', true)->orderBy('sort_order')->orderBy('id')->get()->map(fn (FaqEntry $faq): array => [
            'id' => $faq->id,
            'category' => $faq->category,
            'question' => $faq->question,
            'answer' => $faq->answer,
        ])->values());
    }
}
