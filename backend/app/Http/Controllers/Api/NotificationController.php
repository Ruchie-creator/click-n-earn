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
            'items' => $notifications->getCollection()->map(fn ($notification): array => [
                'id' => $notification->id,
                'title' => data_get($notification->data, 'title', 'Click & Earn update'),
                'body' => data_get($notification->data, 'body', ''),
                'type' => data_get($notification->data, 'type', 'info'),
                'read' => $notification->read_at !== null,
                'created_at' => $notification->created_at?->toISOString(),
            ])->values(),
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
