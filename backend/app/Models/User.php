<?php

namespace App\Models;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
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

    public function referredBy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(self::class, 'referred_by');
    }

    public function referredUsers(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(self::class, 'referred_by');
    }

    public function reservations(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(TaskReservation::class);
    }

    public function tasksCreated(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Task::class, 'created_by');
    }

    public function referralsSent(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Referral::class, 'referrer_id');
    }

    public function referralReceived(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Referral::class, 'referred_user_id');
    }

    public function ledgerEntries(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }

    public function payoutMethods(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PayoutMethod::class);
    }

    public function payouts(): \Illuminate\Database\Eloquent\Relations\HasMany
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
}
