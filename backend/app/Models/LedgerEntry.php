<?php

namespace App\Models;

use App\Enums\LedgerDirection;
use App\Enums\LedgerStatus;
use App\Enums\LedgerType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LedgerEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'task_reservation_id',
        'referral_id',
        'payout_id',
        'type',
        'amount',
        'direction',
        'status',
        'reference',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'type' => LedgerType::class,
            'direction' => LedgerDirection::class,
            'status' => LedgerStatus::class,
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

    public function payout(): BelongsTo
    {
        return $this->belongsTo(Payout::class);
    }
}
