<?php

namespace App\Console\Commands;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PromoteAdminCommand extends Command
{
    protected $signature = 'admin:promote {email : Official administrator email} {--from= : Existing account email to rename and promote} {--create : Create the administrator when no existing account is found} {--super-admin : Grant super-admin rather than admin} {--password= : New password; omit to enter it securely}';

    protected $description = 'Promote an existing account to a non-demo active administrator and optionally reset its password';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Provide a valid official administrator email address.');

            return self::FAILURE;
        }
        $sourceEmail = strtolower(trim((string) ($this->option('from') ?: $email)));
        $user = User::query()->where('email', $sourceEmail)->first();
        if (! $user) {
            if (! $this->option('create')) {
                $this->error('No account exists for that email. Use --from=<existing-email> to rename one, or --create to create the official administrator.');

                return self::FAILURE;
            }
            if (User::query()->where('email', $email)->exists()) {
                $this->error('An account already uses the requested official email.');

                return self::FAILURE;
            }
        }

        $password = (string) ($this->option('password') ?: $this->secret('New password (leave blank to keep the existing password)'));
        if (($user || ! $this->option('create')) && $password !== '' && strlen($password) < 12) {
            $this->error('Use a password with at least 12 characters.');

            return self::FAILURE;
        }
        if (! $user && strlen($password) < 12) {
            $this->error('A new administrator requires a password with at least 12 characters.');

            return self::FAILURE;
        }

        if (! $user) {
            $user = User::create([
                'name' => 'Click & Earn Administrator',
                'email' => $email,
                'password' => Hash::make($password),
                'role' => $this->option('super-admin') ? UserRole::SUPER_ADMIN : UserRole::ADMIN,
                'account_status' => AccountStatus::ACTIVE,
                'email_verified_at' => now(),
                'referral_code' => 'ADMIN'.Str::upper(Str::random(12)),
            ]);
        } elseif ($sourceEmail !== $email) {
            if (User::query()->where('email', $email)->where('id', '!=', $user->id)->exists()) {
                $this->error('Another account already uses the requested official email.');

                return self::FAILURE;
            }
            $user->forceFill(['email' => $email])->save();
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
