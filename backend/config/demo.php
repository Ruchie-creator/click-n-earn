<?php

return [
    'enabled' => (bool) env('DEMO_DATA_ENABLED', false),
    'client_preview' => (bool) env('CLIENT_PREVIEW', false),
    'batch_slug' => env('DEMO_BATCH_SLUG', 'client-preview'),
    'batch_label' => env('DEMO_BATCH_LABEL', 'Click & Earn Client Preview'),
    'accounts' => [
        'member' => [
            'email' => env('DEMO_MEMBER_EMAIL', 'demo.member@clickearn.example'),
            'password' => env('DEMO_MEMBER_PASSWORD'),
        ],
        'member_two' => [
            'email' => env('DEMO_MEMBER_TWO_EMAIL', 'demo.member2@clickearn.example'),
            'password' => env('DEMO_MEMBER_TWO_PASSWORD'),
        ],
        'admin' => [
            'email' => env('DEMO_ADMIN_EMAIL', 'demo.admin@clickearn.example'),
            'password' => env('DEMO_ADMIN_PASSWORD'),
        ],
    ],
];
