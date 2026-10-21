<?php

namespace App\Services;

use RuntimeException;

class AirwallexEnvironment
{
    public function active(): string
    {
        $configured = (string) config('payout.airwallex.environment', 'sandbox');

        return in_array($configured, ['sandbox', 'live'], true) ? $configured : 'sandbox';
    }

    public function setActive(string $environment): void
    {
        if (! in_array($environment, ['sandbox', 'live'], true)) {
            throw new RuntimeException('Airwallex environment must be sandbox or live.');
        }

        if ($environment !== $this->active()) {
            throw new RuntimeException('Airwallex environment is controlled by AIRWALLEX_ENVIRONMENT on the server.');
        }
    }

    public function configuration(string $environment): array
    {
        if (! in_array($environment, ['sandbox', 'live'], true)) {
            throw new RuntimeException('Invalid Airwallex environment.');
        }

        return (array) config('payout.airwallex.'.$environment, []);
    }

    public function isConfigured(string $environment): bool
    {
        $configuration = $this->configuration($environment);

        return filled($configuration['client_id'] ?? null)
            && filled($configuration['api_key'] ?? null)
            && filled($configuration['webhook_secret'] ?? null);
    }
}
