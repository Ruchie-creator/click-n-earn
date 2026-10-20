<?php

namespace App\Services;

use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;

class PayoutAvailability
{
    public function isEnabled(): bool
    {
        return (bool) config('payout.enabled', true);
    }

    public function ensureEnabled(): void
    {
        if ($this->isEnabled()) {
            return;
        }

        throw new ServiceUnavailableHttpException(
            null,
            'Payout services are temporarily unavailable while payment processing is being configured.',
        );
    }
}
