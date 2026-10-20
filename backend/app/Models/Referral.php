<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Referral extends Model
{
    use HasFactory;

    protected $fillable = [
        'referrer_id',
        'referred_user_id',
        'referral_code',
        'registered_at',
        'qualified_at',
        'reward_amount',
        'reward_status',
        'paid_at',
        'qualifying_task_reservation_id',
        'reward_decided_at',
        'reward_decided_by',
        'reward_hold_reason',
        'self_abuse_flagged_at',
        'self_abuse_resolved_at',
        'self_abuse_resolved_by',
        'self_abuse_note',
    ];

    protected function casts(): array
    {
        return [
            'registered_at' => 'datetime',
            'qualified_at' => 'datetime',
            'paid_at' => 'datetime',
            'reward_amount' => 'decimal:2',
            'reward_decided_at' => 'datetime',
            'self_abuse_flagged_at' => 'datetime',
            'self_abuse_resolved_at' => 'datetime',
        ];
    }

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referrer_id');
    }

    public function referredUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_user_id');
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }

    public function payout(): HasOne
    {
        return $this->hasOne(Payout::class);
    }

    public function qualifyingReservation(): BelongsTo
    {
        return $this->belongsTo(TaskReservation::class, 'qualifying_task_reservation_id');
    }

    public function rewardDecider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reward_decided_by');
    }

    public function selfAbuseResolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'self_abuse_resolved_by');
    }
}
