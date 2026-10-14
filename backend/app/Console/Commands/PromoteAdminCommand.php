<?php

namespace App\Console\Commands;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class PromoteAdminCommand extends Command
{
    protected $signature = 'admin:promote {email : Existing account email} {--super-admin : Grant super-admin rather than admin} {--password= : New password; omit to enter it securely}';

    protected $description = 'Promote an existing account to a non-demo active administrator and optionally reset its password';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $user = User::query()->where('email', $email)->first();
        if (! $user) {
            $this->error('No account exists for that email. Register it first or use the correct email.');

            return self::FAILURE;
        }

        $password = (string) ($this->option('password') ?: $this->secret('New password (leave blank to keep the existing password)'));
        if ($password !== '' && strlen($password) < 12) {
            $this->error('Use a password with at least 12 characters.');

            return self::FAILURE;
        }

        $user->forceFill(array_filter([
            'role' => $this->option('super-admin') ? UserRole::SUPER_ADMIN : UserRole::ADMIN,
            'account_status' => AccountStatus::ACTIVE,
            'email_verified_at' => $user->email_verified_at ?: now(),
            'demo_batch_id' => null,
            'demo_key' => null,
            'password' => $password !== '' ? Hash::make($password) : null,
        ], static fn (mixed $value): bool => $value !== null))->save();

        $this->info('Administrator is active, verified, and no longer part of any demo batch.');

        return self::SUCCESS;
    }
}
