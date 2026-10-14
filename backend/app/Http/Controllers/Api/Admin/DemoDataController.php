<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Services\DemoDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class DemoDataController extends ApiController
{
    public function status(Request $request, DemoDataService $demo): JsonResponse
    {
        $this->ensurePreviewControls($request, $demo);

        return $this->ok($demo->status());
    }

    public function seed(Request $request, DemoDataService $demo): JsonResponse
    {
        $this->ensurePreviewControls($request, $demo);

        return $this->ok($demo->seed());
    }

    public function refresh(Request $request, DemoDataService $demo): JsonResponse
    {
        $this->ensurePreviewControls($request, $demo);
        if ($request->input('confirmation') !== 'REFRESH DEMO DATA') {
            throw ValidationException::withMessages(['confirmation' => 'Type REFRESH DEMO DATA to confirm.']);
        }

        return $this->ok($demo->refresh());
    }

    public function clear(Request $request, DemoDataService $demo): JsonResponse
    {
        $this->ensurePreviewControls($request, $demo);
        if ($request->input('confirmation') !== 'CLEAR DEMO DATA') {
            throw ValidationException::withMessages(['confirmation' => 'Type CLEAR DEMO DATA to confirm.']);
        }

        return $this->ok($demo->clear());
    }

    private function ensurePreviewControls(Request $request, DemoDataService $demo): void
    {
        abort_unless($demo->controlsAvailable(), 404);
        abort_if(
            filled($request->user()?->demo_batch_id),
            403,
            'Demo-batch accounts cannot manage preview data. Use the official non-demo administrator account.',
        );
    }
}
