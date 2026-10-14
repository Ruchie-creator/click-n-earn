<?php

namespace App\Http\Controllers\Api;

use App\Models\PayoutMethod;
use App\Services\AirwallexEnvironment;
use App\Services\PayoutProviderInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayoutMethodController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        return $this->ok($request->user()->payoutMethods()->where('status', 'active')->latest()->get()->map(fn (PayoutMethod $method): array => $this->methodPayload($method)));
    }

    public function schema(Request $request, PayoutProviderInterface $provider, AirwallexEnvironment $environments): JsonResponse
    {
        $criteria = $request->validate([
            'country' => ['required', 'string', 'size:2'],
            'currency' => ['required', 'string', 'size:3'],
            'entity_type' => ['required', 'in:PERSONAL,COMPANY'],
            'transfer_method' => ['required', 'in:LOCAL,SWIFT'],
            'local_clearing_system' => ['nullable', 'string', 'max:32'],
        ]);

        try {
            $schema = $provider->beneficiarySchema($criteria, $environments->active());
            $fields = data_get($schema, 'fields', []);
            $fields = is_array($fields) ? $fields : [];

            Log::info('Airwallex beneficiary form schema loaded.', [
                'environment' => $environments->active(),
                'criteria' => $criteria,
                'field_count' => count($fields),
                'field_paths' => collect($fields)->pluck('path')->filter()->values()->all(),
                'field_types' => collect($fields)->filter(fn (mixed $field): bool => is_array($field))->mapWithKeys(
                    fn (mixed $field): array => [(string) data_get($field, 'path') => data_get($field, 'field.type')],
                )->all(),
            ]);

            return $this->ok($schema);
        } catch (RequestException $exception) {
            Log::warning('Airwallex beneficiary schema request failed.', [
                'environment' => $environments->active(),
                'http_status' => $exception->response?->status(),
                'provider_code' => data_get($exception->response?->json(), 'code'),
            ]);

            throw ValidationException::withMessages([
                'payout_method' => 'Airwallex could not load requirements for this bank route. Check the country, currency, and local clearing system, then try again.',
            ]);
        }
    }

    public function countries(PayoutProviderInterface $provider, AirwallexEnvironment $environments): JsonResponse
    {
        try {
            return $this->ok(['countries' => $provider->beneficiaryCountries($environments->active())]);
        } catch (RequestException $exception) {
            Log::warning('Airwallex beneficiary country lookup failed.', [
                'environment' => $environments->active(),
                'http_status' => $exception->response?->status(),
                'provider_code' => data_get($exception->response?->json(), 'code'),
            ]);

            throw ValidationException::withMessages([
                'payout_method' => 'Airwallex could not load supported destination countries. Try again shortly.',
            ]);
        }
    }

    public function store(Request $request, PayoutProviderInterface $provider, AirwallexEnvironment $environments): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['nullable', 'string', 'in:airwallex'],
            'account_holder_name' => ['required', 'string', 'max:160'],
            'account_type' => ['nullable', 'string', 'max:40'],
            'entity_type' => ['required', 'string', 'in:PERSONAL,COMPANY'],
            'transfer_method' => ['required', 'string', 'in:LOCAL,SWIFT'],
            'country' => ['required', 'string', 'size:2'],
            'currency' => ['required', 'string', 'size:3'],
            'routing_details' => ['nullable', 'array'],
            'account_details' => ['required', 'array'],
            'beneficiary_address' => ['nullable', 'array'],
            'is_default' => ['sometimes', 'boolean'],
        ]);
        $data['provider'] = $data['provider'] ?? 'airwallex';
        $data['country'] = strtoupper($data['country']);
        $data['currency'] = strtoupper($data['currency']);
        $accountNumber = (string) (data_get($data, 'account_details.account_number') ?: data_get($data, 'account_details.iban') ?: data_get($data, 'account_details.account_identifier'));
        if (strlen($accountNumber) < 4) {
            throw ValidationException::withMessages(['account_details' => 'Provide the account identifier required by the selected bank route.']);
        }
        $data['account_last4'] = substr($accountNumber, -4);
        $this->validateBeneficiaryWithProvider($data, $provider, $environments);

        $method = DB::transaction(function () use ($request, $data): PayoutMethod {
            if (($data['is_default'] ?? false) === true) {
                $request->user()->payoutMethods()->update(['is_default' => false]);
            }

            $method = $request->user()->payoutMethods()->create(array_merge($data, ['status' => 'active']));
            if ($batchId = $request->user()->getAttribute('demo_batch_id')) {
                $method->forceFill([
                    'demo_batch_id' => $batchId,
                    'demo_key' => 'payout-method-'.$method->id,
                ])->save();
            }

            return $method;
        });

        return $this->ok($this->methodPayload($method), 201);
    }

    public function destroy(Request $request, PayoutMethod $payoutMethod): JsonResponse
    {
        abort_unless($payoutMethod->user_id === $request->user()->id, 404);
        $payoutMethod->update(['status' => 'deleted', 'is_default' => false]);

        return $this->message('Payout method removed.');
    }

    public function update(Request $request, PayoutMethod $payoutMethod, PayoutProviderInterface $provider, AirwallexEnvironment $environments): JsonResponse
    {
        abort_unless($payoutMethod->user_id === $request->user()->id, 404);
        $data = $request->validate([
            'account_holder_name' => ['sometimes', 'required', 'string', 'max:160'],
            'account_type' => ['sometimes', 'nullable', 'string', 'max:40'],
            'entity_type' => ['sometimes', 'required', 'string', 'in:PERSONAL,COMPANY'],
            'transfer_method' => ['sometimes', 'required', 'string', 'in:LOCAL,SWIFT'],
            'country' => ['sometimes', 'required', 'string', 'size:2'],
            'currency' => ['sometimes', 'required', 'string', 'size:3'],
            'routing_details' => ['sometimes', 'nullable', 'array'],
            'account_details' => ['sometimes', 'required', 'array'],
            'beneficiary_address' => ['sometimes', 'nullable', 'array'],
            'is_default' => ['sometimes', 'boolean'],
        ]);
        if (isset($data['country'])) {
            $data['country'] = strtoupper($data['country']);
        }
        if (isset($data['currency'])) {
            $data['currency'] = strtoupper($data['currency']);
        }
        if (isset($data['account_details'])) {
            $identifier = (string) (data_get($data, 'account_details.account_number') ?: data_get($data, 'account_details.iban') ?: data_get($data, 'account_details.account_identifier'));
            if (strlen($identifier) < 4) {
                throw ValidationException::withMessages(['account_details' => 'Provide the account identifier required by the selected bank route.']);
            }
            $data['account_last4'] = substr($identifier, -4);
        }
        $this->validateBeneficiaryWithProvider(array_merge($payoutMethod->only([
            'provider', 'account_holder_name', 'account_type', 'entity_type', 'transfer_method', 'country', 'currency',
            'routing_details', 'account_details', 'beneficiary_address', 'account_last4',
        ]), $data), $provider, $environments);

        DB::transaction(function () use ($request, $payoutMethod, $data): void {
            if (($data['is_default'] ?? false) === true) {
                $request->user()->payoutMethods()->where('id', '!=', $payoutMethod->id)->update(['is_default' => false]);
            }
            $sensitiveFields = ['account_holder_name', 'entity_type', 'transfer_method', 'country', 'currency', 'routing_details', 'account_details', 'beneficiary_address'];
            if (array_intersect(array_keys($data), $sensitiveFields) !== []) {
                $data['provider_beneficiary_id'] = null;
                $data['provider_beneficiaries'] = [];
            }
            $payoutMethod->update($data);
        });

        return $this->ok($this->methodPayload($payoutMethod->fresh()));
    }

    private function methodPayload(PayoutMethod $method): array
    {
        return [
            'id' => $method->id,
            'provider' => $method->provider,
            'account_holder_name' => $method->account_holder_name,
            'account_type' => $method->account_type,
            'entity_type' => $method->entity_type,
            'transfer_method' => $method->transfer_method,
            'country' => $method->country,
            'currency' => $method->currency,
            'masked_account' => $method->maskedAccount(),
            'is_default' => $method->is_default,
            'status' => $method->status,
        ];
    }

    private function validateBeneficiaryWithProvider(array $attributes, PayoutProviderInterface $provider, AirwallexEnvironment $environments): void
    {
        $method = new PayoutMethod($attributes);

        try {
            $provider->validateBeneficiary($method, $environments->active());
        } catch (RequestException $exception) {
            Log::warning('Airwallex beneficiary validation failed.', [
                'environment' => $environments->active(),
                'http_status' => $exception->response?->status(),
                'provider_code' => data_get($exception->response?->json(), 'code'),
                'provider_error_fields' => $this->providerErrorFields($exception),
            ]);

            throw ValidationException::withMessages([
                'payout_method' => $this->beneficiaryValidationMessage($exception),
            ]);
        } catch (ConnectionException $exception) {
            Log::warning('Airwallex beneficiary validation connection failed.', [
                'environment' => $environments->active(),
                'exception' => $exception::class,
            ]);

            throw ValidationException::withMessages([
                'payout_method' => 'Airwallex is temporarily unavailable to validate these payout details. Please try again shortly.',
            ]);
        }
    }

    /** @return list<string> */
    private function providerErrorFields(RequestException $exception): array
    {
        return collect(data_get($exception->response?->json(), 'errors', []))
            ->pluck('source')
            ->filter(fn (mixed $source): bool => is_string($source) && str_starts_with($source, 'beneficiary.'))
            ->values()
            ->all();
    }

    private function beneficiaryValidationMessage(RequestException $exception): string
    {
        $field = $this->providerErrorFields($exception)[0] ?? null;
        if ($field === null) {
            return 'Airwallex could not validate these payout details. Review the required bank fields and try again.';
        }

        $label = str($field)->afterLast('.')->replace('_', ' ')->lower()->toString();

        return 'Update the required bank detail: '.$label.'.';
    }
}
