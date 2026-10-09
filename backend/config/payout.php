<?php

return [
    'driver' => env('PAYOUT_DRIVER', 'fake'),
    'currency' => env('PAYOUT_CURRENCY', 'USD'),
    'fake_outcome' => env('FAKE_PAYOUT_OUTCOME', 'processing'),
    'timeout' => (int) env('PAYOUT_TIMEOUT', 15),
    'airwallex' => [
        'environment' => env('AIRWALLEX_ENVIRONMENT', 'sandbox'),
        'sandbox_base_url' => env('AIRWALLEX_SANDBOX_BASE_URL', 'https://api.sandbox.airwallex.com'),
        'production_base_url' => env('AIRWALLEX_PRODUCTION_BASE_URL', 'https://api.airwallex.com'),
        'client_id' => env('AIRWALLEX_CLIENT_ID'),
        'api_key' => env('AIRWALLEX_API_KEY'),
        'webhook_secret' => env('AIRWALLEX_WEBHOOK_SECRET'),
    ],
];
