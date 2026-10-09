<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
    ];

    protected function casts(): array
    {
        return [
            'registered_at' => 'datetime',
            'qualified_at' => 'datetime',
            'paid_at' => 'datetime',
            'reward_amount' => 'decimal:2',
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

    public function payout(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Payout::class);
    }
}
