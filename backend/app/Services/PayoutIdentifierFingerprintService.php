<?php

namespace App\Services;

use App\Models\PayoutMethod;
use RuntimeException;

class PayoutIdentifierFingerprintService
{
    public function fingerprint(PayoutMethod|array $method): ?string
    {
        $attributes = $method instanceof PayoutMethod ? $method->toArray() : $method;
        $accountDetails = $method instanceof PayoutMethod ? ($method->account_details ?: []) : ($attributes['account_details'] ?? []);
        $routingDetails = $method instanceof PayoutMethod ? ($method->routing_details ?: []) : ($attributes['routing_details'] ?? []);
        $accountNumber = $this->findAccountIdentifier(is_array($accountDetails) ? $accountDetails : []);
        if ($accountNumber === '') {
            return null;
        }

        $routing = $this->normalize($routingDetails);
        $payload = implode('|', [
            strtoupper((string) ($attributes['country'] ?? '')),
            strtoupper((string) ($attributes['currency'] ?? '')),
            $accountNumber,
            json_encode($routing, JSON_THROW_ON_ERROR),
        ]);
        $key = (string) config('app.key');
        if ($key === '') {
            throw new RuntimeException('An application key is required to fingerprint payout identifiers.');
        }

        return hash_hmac('sha256', $payload, $key);
    }

    private function findAccountIdentifier(array $values): string
    {
        foreach (['account_number', 'iban', 'account_identifier'] as $key) {
            if (isset($values[$key]) && is_scalar($values[$key])) {
                return preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $values[$key])) ?: '';
            }
        }

        foreach ($values as $value) {
            if (is_array($value)) {
                $identifier = $this->findAccountIdentifier($value);
                if ($identifier !== '') {
                    return $identifier;
                }
            }
        }

        return '';
    }

    private function normalize(mixed $value): array|string|null
    {
        if (! is_array($value)) {
            return is_scalar($value) ? (preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $value)) ?: '') : null;
        }

        $normalized = [];
        foreach ($value as $key => $item) {
            $normalized[(string) $key] = $this->normalize($item);
        }
        ksort($normalized);

        return $normalized;
    }
}
