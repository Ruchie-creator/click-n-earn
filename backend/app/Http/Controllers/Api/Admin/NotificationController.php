<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\NotificationOutbox;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class NotificationController extends ApiController
{
    public function index(): JsonResponse
    {
        $messages = NotificationOutbox::query()->with('user')->latest()->paginate(50);

        return $this->ok([
            'items' => $messages->getCollection()->map(fn (NotificationOutbox $message): array => [
                'id' => $message->id,
                'title' => $message->title,
                'body' => $message->body,
                'recipient' => $message->user?->email,
                'email_status' => $message->email_status,
                'email_attempts' => $message->email_attempts,
                'email_last_error' => $message->email_last_error,
                'created_at' => $message->created_at?->toISOString(),
            ])->values(),
            'summary' => [
                'sent_this_month' => NotificationOutbox::query()->where('email_status', 'sent')->where('created_at', '>=', now()->startOfMonth())->count(),
                'pending_email' => NotificationOutbox::query()->whereIn('email_status', ['pending', 'sending'])->count(),
                'failed_email' => NotificationOutbox::query()->where('email_status', 'failed')->count(),
                'unread_in_app' => DB::table('notifications')->whereNull('read_at')->count(),
            ],
            'meta' => [
                'current_page' => $messages->currentPage(),
                'last_page' => $messages->lastPage(),
                'total' => $messages->total(),
            ],
        ]);
    }
}
