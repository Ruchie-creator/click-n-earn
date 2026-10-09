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

    public function test_production_configuration_rejects_the_fake_payout_driver(): void
    {
        $app = app();
        $previousEnvironment = $app['env'];
        $previousConfig = [
            'app.debug' => config('app.debug'),
            'app.key' => config('app.key'),
            'app.url' => config('app.url'),
            'payout.driver' => config('payout.driver'),
            'payout.airwallex.environment' => config('payout.airwallex.environment'),
            'payout.airwallex.client_id' => config('payout.airwallex.client_id'),
            'payout.airwallex.api_key' => config('payout.airwallex.api_key'),
            'payout.airwallex.webhook_secret' => config('payout.airwallex.webhook_secret'),
            'payout.airwallex.production_base_url' => config('payout.airwallex.production_base_url'),
            'mail.default' => config('mail.default'),
            'filesystems.proof_disk' => config('filesystems.proof_disk'),
            'cors.allowed_origins' => config('cors.allowed_origins'),
        ];
        $app->instance('env', 'production');
        config([
            'app.debug' => false,
            'app.key' => 'configured-test-key',
            'app.url' => 'https://app.example.com',
            'payout.driver' => 'fake',
            'payout.airwallex.environment' => 'production',
            'payout.airwallex.client_id' => 'configured-test-value',
            'payout.airwallex.api_key' => 'configured-test-value',
            'payout.airwallex.webhook_secret' => 'configured-test-value',
            'payout.airwallex.production_base_url' => 'https://api.airwallex.com',
            'mail.default' => 'smtp',
            'filesystems.proof_disk' => 'proofs',
            'cors.allowed_origins' => ['https://app.example.com'],
        ]);

        try {
            $guard = new ReflectionMethod(AppServiceProvider::class, 'assertProductionConfiguration');
            $guard->setAccessible(true);
            $guard->invoke(new AppServiceProvider($app));
            $this->fail('Production configuration must reject the fake payout provider.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('PAYOUT_DRIVER must be airwallex', $exception->getMessage());
        } finally {
            config($previousConfig);
            $app->instance('env', $previousEnvironment);
        }
    }

    public function test_non_production_environment_rejects_the_airwallex_production_endpoint(): void
    {
        $previousEnvironment = config('payout.airwallex.environment');
        config(['payout.airwallex.environment' => 'production']);

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
