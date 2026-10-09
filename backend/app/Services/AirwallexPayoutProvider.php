<?php

namespace App\Services;

use App\Models\Payout;
use App\Models\PayoutMethod;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class AirwallexPayoutProvider implements PayoutProviderInterface
{
    private function baseUrl(): string
    {
        return rtrim(
            config('payout.airwallex.environment') === 'production'
                ? config('payout.airwallex.production_base_url')
                : config('payout.airwallex.sandbox_base_url'),
            '/',
        );
    }

    private function http(): PendingRequest
    {
        return Http::acceptJson()
            ->asJson()
            ->timeout((int) config('payout.timeout', 15))
            ->withToken($this->accessToken());
    }

    private function accessToken(): string
    {
        $clientId = config('payout.airwallex.client_id');
        $apiKey = config('payout.airwallex.api_key');

        if (blank($clientId) || blank($apiKey)) {
            throw new RuntimeException('Airwallex credentials are not configured.');
        }

        $cacheKey = 'airwallex:access-token:'.hash('sha256', $this->baseUrl().'|'.$clientId.'|'.$apiKey);

        return Cache::remember($cacheKey, now()->addMinutes(25), function () use ($clientId, $apiKey): string {
            $response = Http::acceptJson()
                ->asJson()
                ->timeout((int) config('payout.timeout', 15))
                ->withHeaders([
                    'x-client-id' => $clientId,
                    'x-api-key' => $apiKey,
                ])
                ->post($this->baseUrl().'/api/v1/authentication/login');

            $response->throw();
            $token = data_get($response->json(), 'token') ?: data_get($response->json(), 'data.token');

            if (blank($token)) {
                throw new RuntimeException('Airwallex authentication did not return an access token.');
            }

            return $token;
        });
    }

    public function submit(Payout $payout, PayoutMethod $method): PayoutResult
    {
        $beneficiaryId = $method->provider_beneficiary_id;

        if (blank($beneficiaryId)) {
            $nameParts = preg_split('/\s+/', trim($method->account_holder_name)) ?: [];
            $firstName = (string) ($nameParts[0] ?? $method->account_holder_name);
            $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : $firstName;
            $beneficiaryResponse = $this->http()->post($this->baseUrl().'/api/v1/beneficiaries/create', [
                'beneficiary' => [
                    'entity_type' => 'PERSONAL',
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'bank_details' => array_merge(
                        [
                            'account_currency' => strtoupper($method->currency),
                            'account_name' => $method->account_holder_name,
                            'bank_country_code' => strtoupper($method->country),
                        ],
                        $method->routing_details ?: [],
                        $method->account_details ?: [],
                    ),
                ],
                'transfer_methods' => ['LOCAL'],
                'transfer_reason' => 'other_services',
                'request_id' => 'click-earn-beneficiary-'.$method->id,
            ]);
            $beneficiaryResponse->throw();
            $beneficiaryId = data_get($beneficiaryResponse->json(), 'id')
                ?: data_get($beneficiaryResponse->json(), 'beneficiary.id')
                ?: data_get($beneficiaryResponse->json(), 'data.id');

            if (blank($beneficiaryId)) {
                throw new RuntimeException('Airwallex beneficiary response did not contain an id.');
            }

            $method->forceFill(['provider_beneficiary_id' => $beneficiaryId])->save();
        }

        $response = $this->http()->post($this->baseUrl().'/api/v1/transfers/create', [
            'beneficiary_id' => $beneficiaryId,
            'transfer_amount' => (float) $payout->amount,
            'transfer_currency' => $payout->currency,
            'transfer_method' => 'LOCAL',
            'reason' => 'other_services',
            'reference' => 'CLICK-EARN-'.$payout->id,
            'request_id' => $payout->idempotency_key,
        ]);
        $response->throw();
        $body = $response->json();
        $reference = data_get($body, 'id')
            ?: data_get($body, 'transfer_id')
            ?: data_get($body, 'data.id');
        $status = $this->mapStatus(data_get($body, 'status') ?: data_get($body, 'data.status'));

        return new PayoutResult($status, $reference, 'Airwallex transfer submitted.', $body);
    }

    public function retrieve(Payout $payout): PayoutResult
    {
        if (blank($payout->provider_reference)) {
            return new PayoutResult('failed', null, 'No Airwallex transfer reference is available.');
        }

        $response = $this->http()->get($this->baseUrl().'/api/v1/transfers/'.$payout->provider_reference);
        $response->throw();
        $body = $response->json();
        $rawStatus = data_get($body, 'status') ?: data_get($body, 'data.status');

        return new PayoutResult(
            $this->mapStatus($rawStatus),
            $payout->provider_reference,
            'Airwallex transfer status retrieved.',
            $body,
        );
    }

    private function mapStatus(?string $status): string
    {
        return match (strtolower((string) $status)) {
            'paid', 'completed', 'succeeded' => 'paid',
            'failed', 'cancelled', 'canceled', 'reversed' => 'failed',
            default => 'processing',
        };
    }
}
