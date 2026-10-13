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
        'entity_type',
        'account_holder_name',
        'account_type',
        'country',
        'currency',
        'transfer_method',
        'routing_details',
        'account_details',
        'beneficiary_address',
        'account_last4',
        'provider_beneficiary_id',
        'provider_beneficiaries',
        'status',
        'is_default',
    ];

    protected $hidden = [
        'routing_details',
        'account_details',
        'provider_beneficiary_id',
        'provider_beneficiaries',
    ];

    protected function casts(): array
    {
        return [
            'routing_details' => 'encrypted:array',
            'account_details' => 'encrypted:array',
            'beneficiary_address' => 'encrypted:array',
            'provider_beneficiaries' => 'encrypted:array',
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

    public function beneficiaryIdFor(string $environment): ?string
    {
        return data_get($this->provider_beneficiaries ?: [], $environment);
    }

    public function setBeneficiaryIdFor(string $environment, string $beneficiaryId): void
    {
        $beneficiaries = $this->provider_beneficiaries ?: [];
        $beneficiaries[$environment] = $beneficiaryId;
        $this->forceFill([
            'provider_beneficiaries' => $beneficiaries,
            'provider_beneficiary_id' => $beneficiaryId,
        ])->save();
    }
}
