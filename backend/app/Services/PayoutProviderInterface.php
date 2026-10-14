<?php

namespace App\Services;

use App\Models\Payout;
use App\Models\PayoutMethod;

interface PayoutProviderInterface
{
    public function connectionStatus(string $environment): string;

    public function beneficiarySchema(array $criteria, string $environment): array;

    /** @return list<string> ISO 3166-1 alpha-2 bank destination codes supported by this account. */
    public function beneficiaryCountries(string $environment): array;

    public function validate(Payout $payout, PayoutMethod $method): void;

    public function submit(Payout $payout, PayoutMethod $method): PayoutResult;

    public function retrieve(Payout $payout): PayoutResult;

    public function findByRequestId(Payout $payout): ?PayoutResult;
}
