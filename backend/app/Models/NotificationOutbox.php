<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationOutbox extends Model
{
    protected $table = 'notification_outbox';

    protected $fillable = [
        'user_id',
        'event_key',
        'title',
        'body',
        'type',
        'data',
        'email_status',
        'email_attempts',
        'email_locked_at',
        'email_sent_at',
        'email_last_error',
        'demo_batch_id',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'email_attempts' => 'integer',
            'email_locked_at' => 'datetime',
            'email_sent_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
