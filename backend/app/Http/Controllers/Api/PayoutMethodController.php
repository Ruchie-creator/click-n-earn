<?php

namespace App\Http\Controllers\Api;

use App\Models\PayoutMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PayoutMethodController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        return $this->ok($request->user()->payoutMethods()->where('status', 'active')->latest()->get()->map(fn (PayoutMethod $method): array => $this->methodPayload($method)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['nullable', 'string', 'in:airwallex'],
            'account_holder_name' => ['required', 'string', 'max:160'],
            'account_type' => ['required', 'string', 'max:40'],
            'country' => ['required', 'string', 'size:2'],
            'currency' => ['required', 'string', 'size:3'],
            'routing_details' => ['nullable', 'array'],
            'account_details' => ['required', 'array'],
            'account_details.account_number' => ['required', 'string', 'min:4', 'max:64'],
            'is_default' => ['sometimes', 'boolean'],
        ]);
        $data['provider'] = $data['provider'] ?? 'airwallex';
        $data['country'] = strtoupper($data['country']);
        $data['currency'] = strtoupper($data['currency']);
        $accountNumber = (string) data_get($data, 'account_details.account_number');
        $data['account_last4'] = substr($accountNumber, -4);

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

    public function update(Request $request, PayoutMethod $payoutMethod): JsonResponse
    {
        abort_unless($payoutMethod->user_id === $request->user()->id, 404);
        $data = $request->validate([
            'account_holder_name' => ['sometimes', 'required', 'string', 'max:160'],
            'account_type' => ['sometimes', 'required', 'string', 'max:40'],
            'country' => ['sometimes', 'required', 'string', 'size:2'],
            'currency' => ['sometimes', 'required', 'string', 'size:3'],
            'routing_details' => ['sometimes', 'nullable', 'array'],
            'account_details' => ['sometimes', 'required', 'array'],
            'account_details.account_number' => ['sometimes', 'required', 'string', 'min:4', 'max:64'],
            'is_default' => ['sometimes', 'boolean'],
        ]);
        if (isset($data['country'])) {
            $data['country'] = strtoupper($data['country']);
        }
        if (isset($data['currency'])) {
            $data['currency'] = strtoupper($data['currency']);
        }
        if (isset($data['account_details']['account_number'])) {
            $data['account_last4'] = substr((string) $data['account_details']['account_number'], -4);
        }

        DB::transaction(function () use ($request, $payoutMethod, $data): void {
            if (($data['is_default'] ?? false) === true) {
                $request->user()->payoutMethods()->where('id', '!=', $payoutMethod->id)->update(['is_default' => false]);
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
            'country' => $method->country,
            'currency' => $method->currency,
            'masked_account' => $method->maskedAccount(),
            'is_default' => $method->is_default,
            'status' => $method->status,
        ];
    }
}
