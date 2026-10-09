<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\Setting;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends ApiController
{
    public function index(): JsonResponse
    {
        return $this->ok(Setting::query()->orderBy('key')->get()->map(fn (Setting $setting): array => [
            'key' => $setting->key,
            'value' => $setting->value,
            'updated_at' => $setting->updated_at?->toISOString(),
        ]));
    }

    public function update(Request $request, string $key, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate(['value' => ['required', 'array']]);
        $setting = Setting::firstOrNew(['key' => $key]);
        $before = $setting->exists ? $setting->toArray() : null;
        $setting->value = $data['value'];
        $setting->save();
        $audit->record('setting.updated', $setting, $request, before: $before, after: $setting->toArray(), actorId: $request->user()->id);

        return $this->ok([
            'key' => $setting->key,
            'value' => $setting->value,
            'updated_at' => $setting->updated_at?->toISOString(),
        ]);
    }
}
