<?php

namespace App\Providers;

use App\Services\AirwallexPayoutProvider;
use App\Services\FakePayoutProvider;
use App\Services\PayoutProviderInterface;
use App\Services\ReceiptVerificationProviderInterface;
use App\Services\StructuredReceiptVerificationProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(PayoutProviderInterface::class, function ($app): PayoutProviderInterface {
            return match (config('payout.driver')) {
                'airwallex' => $app->make(AirwallexPayoutProvider::class),
                default => $app->make(FakePayoutProvider::class),
            };
        });
        $this->app->bind(ReceiptVerificationProviderInterface::class, StructuredReceiptVerificationProvider::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->assertTestDatabaseIsolation();
        $this->assertAirwallexEnvironment();
        $this->assertProductionConfiguration();

        RateLimiter::for('api', function (Request $request): Limit {
            return Limit::perMinute(120)->by((string) ($request->user()?->id ?: $request->ip()));
        });
        RateLimiter::for('auth', function (Request $request): Limit {
            return Limit::perMinute(10)->by(strtolower((string) $request->input('email')).'|'.$request->ip());
        });
    }

    private function assertTestDatabaseIsolation(): void
    {
        if (! $this->app->environment('testing')) {
            return;
        }

        $connection = (string) config('database.default');
        $database = (string) config("database.connections.{$connection}.database");
        $url = config("database.connections.{$connection}.url");

        if (in_array($database, ['click_and_earn', 'click_and_earn_development', 'click_and_earn_dev'], true)) {
            throw new RuntimeException('Refusing to boot tests: the configured database is an application/development database.');
        }
        if ($connection !== 'pgsql' || $database !== 'click_and_earn_test' || filled($url)) {
            throw new RuntimeException('Refusing to boot tests unless PostgreSQL is explicitly configured for click_and_earn_test with DB_URL empty.');
        }
    }

    private function assertProductionConfiguration(): void
    {
        if (! $this->app->environment('production')) {
            return;
        }

        $errors = [];
        if (config('app.debug')) {
            $errors[] = 'APP_DEBUG must be false';
        }
        if (blank(config('app.key'))) {
            $errors[] = 'APP_KEY must be configured';
        }
        if (config('demo.enabled') || config('demo.client_preview')) {
            $errors[] = 'DEMO_DATA_ENABLED and CLIENT_PREVIEW must be false';
        }

        $appUrl = (string) config('app.url');
        $appHost = parse_url($appUrl, PHP_URL_HOST);
        if (parse_url($appUrl, PHP_URL_SCHEME) !== 'https' || ! is_string($appHost) || $this->isLoopbackHost($appHost)) {
            $errors[] = 'APP_URL must use the public HTTPS application hostname';
        }

        if (config('payout.driver') !== 'airwallex') {
            $errors[] = 'PAYOUT_DRIVER must be airwallex';
        }
        if (config('payout.airwallex.environment') !== 'production') {
            $errors[] = 'AIRWALLEX_ENVIRONMENT must be production';
        }
        foreach (['client_id', 'api_key', 'webhook_secret'] as $credential) {
            if (blank(config('payout.airwallex.'.$credential))) {
                $errors[] = 'Airwallex production credentials and webhook secret are required';
                break;
            }
        }
        if (in_array(config('mail.default'), ['log', 'array', 'null'], true)) {
            $errors[] = 'MAIL_MAILER must use a production delivery provider';
        }

        $proofDisk = (string) config('filesystems.proof_disk');
        $proofDiskConfig = config('filesystems.disks.'.$proofDisk, []);
        if ($proofDisk === '' || $proofDisk === 'public' || data_get($proofDiskConfig, 'visibility') === 'public') {
            $errors[] = 'Proof storage must use a configured private disk';
        }

        $airwallexBaseUrl = (string) config('payout.airwallex.production_base_url');
        if ($airwallexBaseUrl !== 'https://api.airwallex.com') {
            $errors[] = 'AIRWALLEX_PRODUCTION_BASE_URL must be https://api.airwallex.com';
        }

        $origins = (array) config('cors.allowed_origins', []);
        if ($origins === []) {
            $errors[] = 'Configure at least one production FRONTEND_URL for CORS';
        }
        foreach ($origins as $origin) {
            $host = parse_url((string) $origin, PHP_URL_HOST);
            if (parse_url((string) $origin, PHP_URL_SCHEME) !== 'https' || ! is_string($host) || $this->isLoopbackHost($host)) {
                $errors[] = 'CORS origins must use public HTTPS deployment hostnames';
                break;
            }
        }

        if ($errors !== []) {
            throw new RuntimeException('Production configuration is incomplete: '.implode('; ', $errors).'.');
        }
    }

    private function assertAirwallexEnvironment(): void
    {
        if (! $this->app->environment('production') && config('payout.airwallex.environment') === 'production') {
            throw new RuntimeException('Refusing to use the Airwallex production endpoint outside APP_ENV=production.');
        }
    }

    private function isLoopbackHost(string $host): bool
    {
        $host = strtolower(trim($host, '[]'));

        return $host === 'localhost'
            || str_ends_with($host, '.localhost')
            || $host === '::1'
            || str_starts_with($host, '127.');
    }
}
