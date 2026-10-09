<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_filter([
        env('FRONTEND_URL', env('APP_ENV', 'production') === 'local' ? 'http://127.0.0.1:5173' : null),
        env('FRONTEND_URL_ALT', env('APP_ENV', 'production') === 'local' ? 'http://localhost:5173' : null),
    ])),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
