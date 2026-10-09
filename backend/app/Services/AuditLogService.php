<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditLogService
{
    public function record(
        string $action,
        Model $subject,
        ?Request $request = null,
        ?array $before = null,
        ?array $after = null,
        ?int $actorId = null,
        ?string $reason = null,
    ): AuditLog {
        $log = AuditLog::create([
            'actor_id' => $actorId ?? $request?->user()?->id,
            'actor_type' => $request?->user()?->getMorphClass(),
            'action' => $reason ? $action.':'.$reason : $action,
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'before_data' => $this->redact($before),
            'after_data' => $this->redact($after),
            'ip' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
        ]);

        if ($batchId = $subject->getAttribute('demo_batch_id')) {
            $log->forceFill(['demo_batch_id' => $batchId])->save();
        }

        return $log;
    }

    private function redact(?array $data): ?array
    {
        if ($data === null) {
            return null;
        }

        foreach (['password', 'remember_token', 'routing_details', 'account_details', 'api_key', 'client_id'] as $key) {
            unset($data[$key]);
        }

        return $data;
    }
}
