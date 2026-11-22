<?php

namespace App\Models;

use App\Enums\TaskStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
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
        'category_id',
        'image_path',
        'external_checkout_url',
        'reimbursement_amount',
        'incentive_amount',
        'expected_payout',
        'available_slots',
        'instructions',
        'proof_requirements',
        'content',
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
            'content' => 'array',
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

    public function taskCategory(): BelongsTo
    {
        return $this->belongsTo(TaskCategory::class, 'category_id');
    }

    /**
     * Tasks that should be discoverable by members and the public catalogue.
     *
     * Keep this in one place so status, date, and slot rules cannot drift
     * between endpoints. COALESCE protects historical rows created before the
     * capacity counters were hardened, without changing those records.
     *
     * @param Builder<Task> $query
     * @return Builder<Task>
     */
    public function scopeAvailableForDiscovery(Builder $query): Builder
    {
        return $query
            ->where('status', TaskStatus::AVAILABLE->value)
            ->whereRaw('COALESCE(reserved_slots, 0) + COALESCE(completed_slots, 0) < available_slots')
            ->where(fn (Builder $dates): Builder => $dates
                ->whereNull('starts_at')
                ->orWhere('starts_at', '<=', now()))
            ->where(fn (Builder $dates): Builder => $dates
                ->whereNull('expires_at')
                ->orWhere('expires_at', '>', now()));
    }

    public function isAcceptable(): bool
    {
        return $this->status === TaskStatus::AVAILABLE
            && (! $this->starts_at || $this->starts_at->isPast())
            && (! $this->expires_at || $this->expires_at->isFuture())
            && ($this->reserved_slots + $this->completed_slots) < $this->available_slots;
    }
}
