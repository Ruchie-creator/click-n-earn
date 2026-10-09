<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ProofSubmission extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_reservation_id',
        'user_id',
        'previous_submission_id',
        'version',
        'file_disk',
        'file_path',
        'original_file_name',
        'mime_type',
        'file_size',
        'file_sha256',
        'transaction_reference_key',
        'idempotency_key',
        'request_fingerprint',
        'is_current',
        'purchase_amount',
        'purchase_date',
        'purchase_time',
        'transaction_reference',
        'user_note',
        'status',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'purchase_amount' => 'decimal:2',
            'purchase_date' => 'date',
            'purchase_time' => 'datetime:H:i',
            'submitted_at' => 'datetime',
            'is_current' => 'boolean',
        ];
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(TaskReservation::class, 'task_reservation_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function previousSubmission(): BelongsTo
    {
        return $this->belongsTo(self::class, 'previous_submission_id');
    }

    public function verification(): HasOne
    {
        return $this->hasOne(ReceiptVerification::class);
    }
}
