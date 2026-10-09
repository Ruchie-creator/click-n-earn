<?php

$projectRoot = dirname(__DIR__);
$cachedConfig = getenv('APP_CONFIG_CACHE') ?: $projectRoot.'/bootstrap/cache/config.php';
$cachedRoutes = getenv('APP_ROUTES_CACHE') ?: $projectRoot.'/bootstrap/cache/routes-v7.php';

if (is_file($cachedConfig)) {
    throw new RuntimeException('Refusing to run tests with cached Laravel configuration. Run php artisan config:clear first.');
}

if (is_file($cachedRoutes)) {
    throw new RuntimeException('Refusing to run tests with cached Laravel routes. Run php artisan route:clear first.');
}

if (getenv('APP_ENV') !== 'testing') {
    throw new RuntimeException('Refusing to run tests unless APP_ENV=testing.');
}

$database = getenv('DB_DATABASE') ?: '';
if (in_array($database, ['click_and_earn', 'click_and_earn_development', 'click_and_earn_dev'], true)) {
    throw new RuntimeException('Refusing to run tests: the configured database is an application/development database.');
}

if ($database !== 'click_and_earn_test') {
    throw new RuntimeException('Refusing to run tests unless DB_DATABASE is explicitly click_and_earn_test.');
}

if (getenv('DB_CONNECTION') !== 'pgsql' || (getenv('DB_URL') !== false && getenv('DB_URL') !== '')) {
    throw new RuntimeException('Refusing to run tests unless the PostgreSQL test connection is explicit and DB_URL is empty.');
}

require $projectRoot.'/vendor/autoload.php';
