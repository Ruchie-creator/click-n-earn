<?php

return [
    'currency' => env('PAYOUT_CURRENCY', 'USD'),
    'timeout' => (int) env('PAYOUT_TIMEOUT', 15),
    'airwallex' => [
        'environment' => env('AIRWALLEX_ENVIRONMENT', 'sandbox'),
        'sandbox' => [
            'base_url' => env('AIRWALLEX_SANDBOX_BASE_URL', 'https://api.sandbox.airwallex.com/api/v1'),
            'client_id' => env('AIRWALLEX_SANDBOX_CLIENT_ID'),
            'api_key' => env('AIRWALLEX_SANDBOX_API_KEY'),
            'webhook_secret' => env('AIRWALLEX_SANDBOX_WEBHOOK_SECRET'),
        ],
        'live' => [
            'base_url' => env('AIRWALLEX_LIVE_BASE_URL', 'https://api.airwallex.com/api/v1'),
            'client_id' => env('AIRWALLEX_LIVE_CLIENT_ID'),
            'api_key' => env('AIRWALLEX_LIVE_API_KEY'),
            'webhook_secret' => env('AIRWALLEX_LIVE_WEBHOOK_SECRET'),
        ],
    ],
];
