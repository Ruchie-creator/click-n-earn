<?php

return [
    // Capacity is retained as legacy accounting data, but task discovery and
    // reservations are unlimited unless explicitly enabled for a test/legacy
    // environment.
    'capacity_limits_enabled' => filter_var(env('TASK_CAPACITY_LIMITS_ENABLED', false), FILTER_VALIDATE_BOOL),
    'unlimited_slots' => 2147483647,
];
