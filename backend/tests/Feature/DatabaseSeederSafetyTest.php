<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use RuntimeException;
use Tests\TestCase;

class DatabaseSeederSafetyTest extends TestCase
{
    public function test_fictional_seed_data_is_refused_outside_local_and_test_environments(): void
    {
        $app = app();
        $previousEnvironment = $app['env'];
        $app->instance('env', 'production');

        try {
            (new DatabaseSeeder())->run();
            $this->fail('The demo seeder should refuse to run in production.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('restricted to local development and automated tests', $exception->getMessage());
        } finally {
            $app->instance('env', $previousEnvironment);
        }
    }
}
