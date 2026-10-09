<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReceiptVerification extends Model
{
    protected $fillable = [
        'proof_submission_id',
        'provider',
        'detected_amount',
        'detected_date',
        'detected_time',
        'detected_reference',
        'confidence_score',
        'amount_matches',
        'date_valid',
        'reference_present',
        'warnings',
        'raw_provider_response',
    ];

    protected function casts(): array
    {
        return [
            'detected_amount' => 'decimal:2',
            'detected_date' => 'date',
            'detected_time' => 'datetime:H:i',
            'confidence_score' => 'decimal:2',
            'amount_matches' => 'boolean',
            'date_valid' => 'boolean',
            'reference_present' => 'boolean',
            'warnings' => 'array',
            'raw_provider_response' => 'array',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(ProofSubmission::class, 'proof_submission_id');
    }
}
