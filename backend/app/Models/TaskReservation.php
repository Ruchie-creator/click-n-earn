<?php

namespace App\Models;

use App\Enums\ReservationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TaskReservation extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'task_id',
        'reimbursement_amount',
        'incentive_amount',
        'expected_payout',
        'status',
        'reserved_at',
        'expires_at',
        'submitted_at',
        'approved_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'reimbursement_amount' => 'decimal:2',
            'incentive_amount' => 'decimal:2',
            'expected_payout' => 'decimal:2',
            'status' => ReservationStatus::class,
            'reserved_at' => 'datetime',
            'expires_at' => 'datetime',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function proofSubmissions(): HasMany
    {
        return $this->hasMany(ProofSubmission::class);
    }

    public function latestProofSubmission(): HasOne
    {
        return $this->hasOne(ProofSubmission::class)->where('is_current', true);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }

    public function payout(): HasOne
    {
        return $this->hasOne(Payout::class);
    }

    public function statusHistories(): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        return $this->morphMany(StatusHistory::class, 'subject');
    }
}
