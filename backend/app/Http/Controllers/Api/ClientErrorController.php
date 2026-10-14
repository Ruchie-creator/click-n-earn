<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ClientErrorController extends ApiController
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'string', 'in:render,error,unhandled_rejection'],
            'message' => ['required', 'string', 'max:1000'],
            'stack' => ['nullable', 'string', 'max:4000'],
            'page' => ['required', 'string', 'max:255', 'regex:/^\/[A-Za-z0-9\/_-]*$/'],
        ]);

        Log::error('Client application error.', [
            'user_id' => $request->user()->id,
            'kind' => $data['kind'],
            'message' => $data['message'],
            'stack' => $data['stack'] ?? null,
            'page' => $data['page'],
        ]);

        return $this->message('Client error recorded.', 202);
    }
}
