<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

class AirwallexEnvironment
{
    public function active(): string
    {
        $configured = Cache::remember('airwallex:active-environment', now()->addMinutes(1), function (): string {
            return (string) data_get(Setting::query()->where('key', 'airwallex.environment')->value('value'), 'environment', config('payout.airwallex.environment', 'sandbox'));
        });

        return in_array($configured, ['sandbox', 'live'], true) ? $configured : 'sandbox';
    }

    public function setActive(string $environment): void
    {
        if (! in_array($environment, ['sandbox', 'live'], true)) {
            throw new RuntimeException('Airwallex environment must be sandbox or live.');
        }

        Setting::updateOrCreate(['key' => 'airwallex.environment'], ['value' => ['environment' => $environment]]);
        Cache::forget('airwallex:active-environment');
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
