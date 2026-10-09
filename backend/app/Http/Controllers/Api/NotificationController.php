<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()->notifications()->latest()->paginate(30);

        return $this->ok([
            'items' => $notifications->getCollection()->map(function ($notification): array {
                $data = $notification->data;
                $eventKey = data_get($data, 'event_key');
                $eventType = data_get($data, 'event_type') ?? ($eventKey
                    ? implode('.', array_slice(explode('.', $eventKey), 0, 2))
                    : null);

                return [
                    'id' => $notification->id,
                    'title' => data_get($data, 'title', 'Click & Earn update'),
                    'body' => data_get($data, 'body', ''),
                    'type' => data_get($data, 'type', 'info'),
                    'event_type' => $eventType,
                    'event_key' => $eventKey,
                    'task_id' => data_get($data, 'task_id'),
                    'reservation_id' => data_get($data, 'reservation_id'),
                    'proof_submission_id' => data_get($data, 'proof_submission_id'),
                    'payout_id' => data_get($data, 'payout_id'),
                    'referral_id' => data_get($data, 'referral_id'),
                    'read' => $notification->read_at !== null,
                    'created_at' => $notification->created_at?->toISOString(),
                ];
            })->values(),
            'unread_count' => $request->user()->unreadNotifications()->count(),
            'meta' => ['current_page' => $notifications->currentPage(), 'last_page' => $notifications->lastPage(), 'total' => $notifications->total()],
        ]);
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        $model = $request->user()->notifications()->whereKey($notification)->firstOrFail();
        $model->markAsRead();

        return $this->message('Notification marked as read.');
    }

    public function readAll(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return $this->message('Notifications marked as read.');
    }
}
