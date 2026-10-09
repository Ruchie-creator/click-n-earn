<?php

namespace App\Models;

use App\Enums\PayoutStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payout extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'task_reservation_id',
        'referral_id',
        'payout_method_id',
        'provider',
        'amount',
        'currency',
        'status',
        'provider_reference',
        'idempotency_key',
        'requested_at',
        'processing_at',
        'paid_at',
        'failed_at',
        'failure_reason',
        'manual_reference',
        'manual_note',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'status' => PayoutStatus::class,
            'requested_at' => 'datetime',
            'processing_at' => 'datetime',
            'paid_at' => 'datetime',
            'failed_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(TaskReservation::class, 'task_reservation_id');
    }

    public function referral(): BelongsTo
    {
        return $this->belongsTo(Referral::class);
    }

    public function payoutMethod(): BelongsTo
    {
        return $this->belongsTo(PayoutMethod::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }
}
