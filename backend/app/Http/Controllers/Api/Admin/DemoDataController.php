<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Services\DemoDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class DemoDataController extends ApiController
{
    public function status(DemoDataService $demo): JsonResponse
    {
        $this->ensurePreviewControls($demo);

        return $this->ok($demo->status());
    }

    public function seed(DemoDataService $demo): JsonResponse
    {
        $this->ensurePreviewControls($demo);

        return $this->ok($demo->seed());
    }

    public function refresh(Request $request, DemoDataService $demo): JsonResponse
    {
        $this->ensurePreviewControls($demo);
        if ($request->input('confirmation') !== 'REFRESH DEMO DATA') {
            throw ValidationException::withMessages(['confirmation' => 'Type REFRESH DEMO DATA to confirm.']);
        }

        return $this->ok($demo->refresh());
    }

    public function clear(Request $request, DemoDataService $demo): JsonResponse
    {
        $this->ensurePreviewControls($demo);
        if ($request->input('confirmation') !== 'CLEAR DEMO DATA') {
            throw ValidationException::withMessages(['confirmation' => 'Type CLEAR DEMO DATA to confirm.']);
        }

        return $this->ok($demo->clear());
    }

    private function ensurePreviewControls(DemoDataService $demo): void
    {
        abort_unless($demo->controlsAvailable(), 404);
    }
}
