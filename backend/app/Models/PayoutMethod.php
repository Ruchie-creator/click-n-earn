<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayoutMethod extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'provider',
        'account_holder_name',
        'account_type',
        'country',
        'currency',
        'routing_details',
        'account_details',
        'account_last4',
        'provider_beneficiary_id',
        'status',
        'is_default',
    ];

    protected $hidden = [
        'routing_details',
        'account_details',
        'provider_beneficiary_id',
    ];

    protected function casts(): array
    {
        return [
            'routing_details' => 'encrypted:array',
            'account_details' => 'encrypted:array',
            'is_default' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(Payout::class);
    }

    public function maskedAccount(): string
    {
        return '****'.$this->account_last4;
    }
}
