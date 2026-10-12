<?php

namespace App\Models;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Notifications\PasswordResetNotification;
use Database\Factories\UserFactory;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name',
    'email',
    'password',
    'phone',
    'country',
    'avatar_path',
    'role',
    'account_status',
    'referral_code',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements CanResetPasswordContract
{
    /** @use HasFactory<UserFactory> */
    use CanResetPassword, HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'account_status' => AccountStatus::class,
        ];
    }

    public function referredBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'referred_by');
    }

    public function referredUsers(): HasMany
    {
        return $this->hasMany(self::class, 'referred_by');
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(TaskReservation::class);
    }

    public function tasksCreated(): HasMany
    {
        return $this->hasMany(Task::class, 'created_by');
    }

    public function referralsSent(): HasMany
    {
        return $this->hasMany(Referral::class, 'referrer_id');
    }

    public function referralReceived(): HasOne
    {
        return $this->hasOne(Referral::class, 'referred_user_id');
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }

    public function payoutMethods(): HasMany
    {
        return $this->hasMany(PayoutMethod::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(Payout::class);
    }

    public function hasRole(UserRole|string ...$roles): bool
    {
        $current = $this->role instanceof UserRole ? $this->role->value : (string) $this->role;

        return in_array($current, array_map(
            static fn (UserRole|string $role): string => $role instanceof UserRole ? $role->value : $role,
            $roles,
        ), true);
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new PasswordResetNotification($token));
    }
}
