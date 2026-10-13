<?php

namespace Tests\Unit;

use App\Providers\AppServiceProvider;
use ReflectionMethod;
use RuntimeException;
use Tests\TestCase;

class ReleaseConfigurationSafetyTest extends TestCase
{
    public function test_testing_environment_rejects_an_application_database(): void
    {
        $oldDefault = config('database.default');
        $oldDatabase = config('database.connections.pgsql.database');
        $oldUrl = config('database.connections.pgsql.url');
        config([
            'database.default' => 'pgsql',
            'database.connections.pgsql.database' => 'click_and_earn',
            'database.connections.pgsql.url' => null,
        ]);

        try {
            $guard = new ReflectionMethod(AppServiceProvider::class, 'assertTestDatabaseIsolation');
            $guard->setAccessible(true);
            $guard->invoke(new AppServiceProvider(app()));
            $this->fail('The application database must be rejected in the testing environment.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('application/development database', $exception->getMessage());
        } finally {
            config([
                'database.default' => $oldDefault,
                'database.connections.pgsql.database' => $oldDatabase,
                'database.connections.pgsql.url' => $oldUrl,
            ]);
        }
    }

    public function test_production_configuration_requires_live_airwallex_configuration(): void
    {
        $app = app();
        $previousEnvironment = $app['env'];
        $previousConfig = [
            'app.debug' => config('app.debug'),
            'app.key' => config('app.key'),
            'app.url' => config('app.url'),
            'payout.airwallex.environment' => config('payout.airwallex.environment'),
            'payout.airwallex.live.client_id' => config('payout.airwallex.live.client_id'),
            'payout.airwallex.live.api_key' => config('payout.airwallex.live.api_key'),
            'payout.airwallex.live.webhook_secret' => config('payout.airwallex.live.webhook_secret'),
            'payout.airwallex.live.base_url' => config('payout.airwallex.live.base_url'),
            'mail.default' => config('mail.default'),
            'filesystems.proof_disk' => config('filesystems.proof_disk'),
            'cors.allowed_origins' => config('cors.allowed_origins'),
        ];
        $app->instance('env', 'production');
        config([
            'app.debug' => false,
            'app.key' => 'configured-test-key',
            'app.url' => 'https://app.example.com',
            'payout.airwallex.environment' => 'sandbox',
            'payout.airwallex.live.client_id' => 'configured-test-value',
            'payout.airwallex.live.api_key' => 'configured-test-value',
            'payout.airwallex.live.webhook_secret' => 'configured-test-value',
            'payout.airwallex.live.base_url' => 'https://api.airwallex.com/api/v1',
            'mail.default' => 'smtp',
            'filesystems.proof_disk' => 'proofs',
            'cors.allowed_origins' => ['https://app.example.com'],
        ]);

        try {
            $guard = new ReflectionMethod(AppServiceProvider::class, 'assertProductionConfiguration');
            $guard->setAccessible(true);
            $guard->invoke(new AppServiceProvider($app));
            $this->fail('Production configuration must reject sandbox as the configured live payout mode.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('AIRWALLEX_ENVIRONMENT must be live', $exception->getMessage());
        } finally {
            config($previousConfig);
            $app->instance('env', $previousEnvironment);
        }
    }

    public function test_non_production_environment_rejects_the_airwallex_production_endpoint(): void
    {
        $previousEnvironment = config('payout.airwallex.environment');
        config(['payout.airwallex.environment' => 'live']);

        try {
            $guard = new ReflectionMethod(AppServiceProvider::class, 'assertAirwallexEnvironment');
            $guard->setAccessible(true);
            $guard->invoke(new AppServiceProvider(app()));
            $this->fail('A non-production environment must not use the Airwallex production endpoint.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('outside APP_ENV=production', $exception->getMessage());
        } finally {
            config(['payout.airwallex.environment' => $previousEnvironment]);
        }
    }
}
