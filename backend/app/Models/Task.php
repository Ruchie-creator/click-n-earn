<?php

namespace App\Models;

use App\Enums\TaskStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'slug',
        'description',
        'category',
        'image_path',
        'external_checkout_url',
        'reimbursement_amount',
        'incentive_amount',
        'expected_payout',
        'available_slots',
        'instructions',
        'proof_requirements',
        'status',
        'starts_at',
        'expires_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'reimbursement_amount' => 'decimal:2',
            'incentive_amount' => 'decimal:2',
            'expected_payout' => 'decimal:2',
            'instructions' => 'array',
            'proof_requirements' => 'array',
            'status' => TaskStatus::class,
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(TaskReservation::class);
    }

    public function isAcceptable(): bool
    {
        return $this->status === TaskStatus::AVAILABLE
            && (! $this->starts_at || $this->starts_at->isPast())
            && (! $this->expires_at || $this->expires_at->isFuture())
            && ($this->reserved_slots + $this->completed_slots) < $this->available_slots;
    }
}
