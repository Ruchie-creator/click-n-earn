<?php

namespace App\Services;

use App\Exceptions\AirwallexReconciliationRequired;
use App\Models\Payout;
use App\Models\PayoutMethod;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class AirwallexPayoutProvider implements PayoutProviderInterface
{
    public function __construct(
        private readonly AirwallexEnvironment $environments,
        private readonly PayoutAvailability $availability,
    ) {}

    public function connectionStatus(string $environment): string
    {
        if (! $this->availability->isEnabled()) {
            return 'disabled';
        }

        try {
            $this->accessToken($environment);

            return 'connected';
        } catch (RequestException $exception) {
            return $exception->response?->status() === 403 ? 'insufficient_permissions' : 'authentication_failed';
        } catch (Throwable) {
            return 'authentication_failed';
        }
    }

    public function beneficiarySchema(array $criteria, string $environment): array
    {
        return $this->http($environment)->post($this->endpoint($environment, 'beneficiary_form_schemas/generate'), array_filter([
            'type' => 'BANK_ACCOUNT',
            'entity_type' => $criteria['entity_type'] ?? null,
            'bank_country_code' => filled($criteria['country'] ?? null) ? strtoupper((string) $criteria['country']) : null,
            'account_currency' => filled($criteria['currency'] ?? null) ? strtoupper((string) $criteria['currency']) : null,
            'transfer_method' => $criteria['transfer_method'] ?? null,
            'local_clearing_system' => $criteria['local_clearing_system'] ?? null,
        ], fn (mixed $value): bool => $value !== null))->throw()->json();
    }

    public function beneficiaryCountries(string $environment): array
    {
        $cacheKey = 'airwallex:beneficiary-countries:'.$environment;

        return Cache::remember($cacheKey, now()->addHours(6), function () use ($environment): array {
            $payload = $this->http($environment)->post(
                $this->endpoint($environment, 'beneficiary_form_schemas/generate'),
                ['type' => 'BANK_ACCOUNT'],
            )->throw()->json();
            $field = collect(data_get($payload, 'fields', []))->first(
                fn (mixed $candidate): bool => data_get($candidate, 'path') === 'beneficiary.bank_details.bank_country_code',
            );
            $rule = data_get($field, 'rule', []);
            $values = array_merge(
                (array) data_get($rule, 'values', []),
                (array) data_get($rule, 'enum', []),
                (array) data_get($field, 'options', []),
                (array) data_get($field, 'field.options', []),
            );
            $pattern = (string) data_get($rule, 'pattern', '');
            preg_match_all('/(?<![A-Z])[A-Z]{2}(?![A-Z])/', $pattern, $matches);
            $values = array_merge($values, $matches[0] ?? []);

            return collect($values)
                ->map(fn (mixed $value): string => is_array($value) ? (string) ($value['value'] ?? '') : (string) $value)
                ->map(fn (string $value): string => strtoupper(trim($value)))
                ->filter(fn (string $value): bool => preg_match('/^[A-Z]{2}$/', $value) === 1)
                ->unique()
                ->sort()
                ->values()
                ->all();
        });
    }

    public function validateBeneficiary(PayoutMethod $method, string $environment): void
    {
        $this->http($environment)->post($this->endpoint($environment, 'beneficiaries/validate'), [
            'beneficiary' => $this->beneficiaryPayload($method),
            'transfer_methods' => [$method->transfer_method ?: 'LOCAL'],
            'transfer_reason' => 'other_services',
            'payer_entity_type' => 'COMPANY',
        ])->throw();
    }

    public function validate(Payout $payout, PayoutMethod $method): void
    {
        $this->http($payout->provider_environment)->post(
            $this->endpoint($payout->provider_environment, 'transfers/validate'),
            $this->transferPayload($payout, $method, $method->beneficiaryIdFor($payout->provider_environment)),
        )->throw();
    }

    public function submit(Payout $payout, PayoutMethod $method): PayoutResult
    {
        $environment = $payout->provider_environment;
        $beneficiaryId = $method->beneficiaryIdFor($environment);

        try {
            if (blank($beneficiaryId)) {
                $response = $this->http($environment)->post($this->endpoint($environment, 'beneficiaries/create'), [
                    'beneficiary' => $this->beneficiaryPayload($method),
                    'transfer_methods' => [$method->transfer_method ?: 'LOCAL'],
                    'transfer_reason' => 'other_services',
                    'request_id' => 'click-earn-beneficiary-'.$environment.'-'.$method->id,
                ]);
                $response->throw();
                $beneficiaryId = data_get($response->json(), 'id') ?: data_get($response->json(), 'beneficiary.id') ?: data_get($response->json(), 'data.id');
                if (blank($beneficiaryId)) {
                    throw new RuntimeException('Airwallex beneficiary response did not contain an id.');
                }
                $method->setBeneficiaryIdFor($environment, (string) $beneficiaryId);
            }

            $payload = $this->transferPayload($payout, $method, $beneficiaryId);
            $this->http($environment)->post($this->endpoint($environment, 'transfers/validate'), $payload)->throw();
            $response = $this->http($environment)->post($this->endpoint($environment, 'transfers/create'), $payload);
            $response->throw();

            return $this->resultFromPayload($response->json(), 'Airwallex transfer submitted.');
        } catch (ConnectionException|RequestException $exception) {
            if ($exception instanceof RequestException && $exception->response?->status() < 500) {
                throw $exception;
            }

            throw new AirwallexReconciliationRequired('Airwallex did not provide a definitive transfer result.', previous: $exception);
        }
    }

    public function retrieve(Payout $payout): PayoutResult
    {
        if (blank($payout->provider_reference)) {
            return $this->findByRequestId($payout) ?? throw new AirwallexReconciliationRequired('No Airwallex transfer reference is available.');
        }

        $response = $this->http($payout->provider_environment)->get($this->endpoint($payout->provider_environment, 'transfers/'.$payout->provider_reference));
        $response->throw();

        return $this->resultFromPayload($response->json(), 'Airwallex transfer status retrieved.');
    }

    public function findByRequestId(Payout $payout): ?PayoutResult
    {
        if (blank($payout->provider_request_id)) {
            return null;
        }
        $response = $this->http($payout->provider_environment)->get($this->endpoint($payout->provider_environment, 'transfers'), ['request_id' => $payout->provider_request_id]);
        $response->throw();
        $body = $response->json();
        $transfer = data_get($body, 'items.0') ?: data_get($body, 'data.items.0') ?: data_get($body, 'data.0');

        return is_array($transfer) ? $this->resultFromPayload($transfer, 'Airwallex transfer found by request id.') : null;
    }

    private function beneficiaryPayload(PayoutMethod $method): array
    {
        $nameParts = preg_split('/\s+/', trim($method->account_holder_name)) ?: [];
        $firstName = (string) ($nameParts[0] ?? $method->account_holder_name);
        $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : $firstName;

        return array_filter([
            'type' => data_get($method->account_details, 'type', 'BANK_ACCOUNT'),
            'entity_type' => $method->entity_type ?: 'PERSONAL',
            'first_name' => $method->entity_type === 'COMPANY' ? null : $firstName,
            'last_name' => $method->entity_type === 'COMPANY' ? null : $lastName,
            'company_name' => $method->entity_type === 'COMPANY' ? $method->account_holder_name : null,
            'bank_details' => array_merge(['account_currency' => strtoupper($method->currency), 'account_name' => $method->account_holder_name, 'bank_country_code' => strtoupper($method->country)], $method->routing_details ?: [], Arr::except($method->account_details ?: [], ['additional_info', 'nickname', 'type'])),
            'address' => $method->beneficiary_address ?: null,
            'additional_info' => data_get($method->account_details, 'additional_info'),
            'nickname' => data_get($method->account_details, 'nickname'),
        ], fn (mixed $value): bool => $value !== null);
    }

    private function transferPayload(Payout $payout, PayoutMethod $method, ?string $beneficiaryId): array
    {
        return [
            'beneficiary_id' => $beneficiaryId,
            'transfer_amount' => (float) $payout->amount,
            'transfer_currency' => $payout->currency,
            // Funding currency is mandatory for Airwallex transfer validation.
            // Matching it to the payout currency avoids an FX conversion.
            'source_currency' => $payout->currency,
            'transfer_method' => $method->transfer_method ?: 'LOCAL',
            'reason' => 'other_services',
            'reference' => 'CLICK-EARN-'.$payout->id,
            'request_id' => $payout->provider_request_id,
        ];
    }

    private function resultFromPayload(array $body, string $message): PayoutResult
    {
        $reference = data_get($body, 'id') ?: data_get($body, 'transfer_id') ?: data_get($body, 'data.id');

        return new PayoutResult($this->mapStatus(data_get($body, 'status') ?: data_get($body, 'data.status')), $reference, $message, $body);
    }

    private function http(string $environment): PendingRequest
    {
        $this->availability->ensureEnabled();

        return Http::acceptJson()->asJson()->timeout((int) config('payout.timeout', 15))->withToken($this->accessToken($environment));
    }

    private function accessToken(string $environment): string
    {
        $configuration = $this->environments->configuration($environment);
        $clientId = $configuration['client_id'] ?? null;
        $apiKey = $configuration['api_key'] ?? null;
        if (blank($clientId) || blank($apiKey)) {
            throw new RuntimeException('Airwallex credentials are not configured.');
        }
        $cacheKey = 'airwallex:access-token:'.$environment.':'.hash('sha256', $clientId.'|'.$apiKey);

        return Cache::lock($cacheKey.':lock', 10)->block(5, function () use ($cacheKey, $clientId, $apiKey, $environment): string {
            return Cache::remember($cacheKey, now()->addMinutes(25), function () use ($clientId, $apiKey, $environment): string {
                $response = Http::acceptJson()->asJson()->timeout((int) config('payout.timeout', 15))->withHeaders(['x-client-id' => $clientId, 'x-api-key' => $apiKey])->post($this->endpoint($environment, 'authentication/login'));
                $response->throw();
                $token = data_get($response->json(), 'token');
                if (blank($token)) {
                    throw new RuntimeException('Airwallex authentication did not return an access token.');
                }

                return $token;
            });
        });
    }

    private function endpoint(string $environment, string $path): string
    {
        return rtrim((string) ($this->environments->configuration($environment)['base_url'] ?? ''), '/').'/'.ltrim($path, '/');
    }

    private function mapStatus(?string $status): string
    {
        return match (strtolower((string) $status)) {
            'paid', 'completed', 'succeeded' => 'paid',
            'sent' => 'sent',
            'failed', 'cancelled', 'canceled', 'reversed' => 'failed',
            default => 'processing',
        };
    }
}
