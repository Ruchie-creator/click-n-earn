<?php

namespace App\Http\Controllers\Api;

use App\Models\PayoutMethod;
use App\Models\User;
use App\Notifications\EventNotification;
use App\Services\AirwallexEnvironment;
use App\Services\AuditLogService;
use App\Services\EventNotificationService;
use App\Services\PayoutAvailability;
use App\Services\PayoutIdentifierFingerprintService;
use App\Services\PayoutProviderInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PayoutMethodController extends ApiController
{
    public function __construct(private readonly PayoutAvailability $availability) {}

    public function index(Request $request): JsonResponse
    {
        return $this->ok($request->user()->payoutMethods()->where('status', '!=', 'deleted')->latest()->get()->map(fn (PayoutMethod $method): array => $this->methodPayload($method)));
    }

    public function schema(Request $request, PayoutProviderInterface $provider, AirwallexEnvironment $environments): JsonResponse
    {
        $this->availability->ensureEnabled();

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
                'payout_method' => 'We could not load requirements for this bank route. Check the country, currency, and local clearing system, then try again.',
            ]);
        }
    }

    public function countries(PayoutProviderInterface $provider, AirwallexEnvironment $environments): JsonResponse
    {
        $this->availability->ensureEnabled();

        try {
            return $this->ok(['countries' => $provider->beneficiaryCountries($environments->active())]);
        } catch (RequestException $exception) {
            Log::warning('Airwallex beneficiary country lookup failed.', [
                'environment' => $environments->active(),
                'http_status' => $exception->response?->status(),
                'provider_code' => data_get($exception->response?->json(), 'code'),
            ]);

            throw ValidationException::withMessages([
                'payout_method' => 'Supported bank destinations could not be loaded. Try again shortly.',
            ]);
        }
    }

    public function store(
        Request $request,
        PayoutProviderInterface $provider,
        AirwallexEnvironment $environments,
        PayoutIdentifierFingerprintService $fingerprints,
        EventNotificationService $notifications,
        AuditLogService $audit,
    ): JsonResponse {
        $this->availability->ensureEnabled();

        $data = $this->validatedMethodData($request);
        $this->validateBeneficiaryWithProvider($data, $provider, $environments);
        $result = $this->createPendingMethod($request, $data, $fingerprints);
        $this->recordSubmission($request, $result['method'], $result['resubmission'], $result['duplicate'], $notifications, $audit);

        return $this->ok($this->methodPayload($result['method']), 201);
    }

    public function destroy(Request $request, PayoutMethod $payoutMethod): JsonResponse
    {
        abort_unless($payoutMethod->user_id === $request->user()->id, 404);
        abort_if($payoutMethod->payouts()->whereIn('status', ['approved', 'processing', 'sent', 'reconciliation_required'])->exists(), 422, 'This bank account is attached to a payout in progress and cannot be removed yet.');
        $payoutMethod->update(['status' => 'deleted', 'is_default' => false]);

        return $this->message('Payout method removed.');
    }

    public function update(
        Request $request,
        PayoutMethod $payoutMethod,
        PayoutProviderInterface $provider,
        AirwallexEnvironment $environments,
        PayoutIdentifierFingerprintService $fingerprints,
        EventNotificationService $notifications,
        AuditLogService $audit,
    ): JsonResponse {
        abort_unless($payoutMethod->user_id === $request->user()->id, 404);
        if ($request->has('is_default') && count($request->all()) === 1) {
            abort_unless($payoutMethod->verification_status === 'approved' && ! $payoutMethod->duplicate_flagged_at, 422, 'Only an approved bank account can be selected as the default payout method.');
            DB::transaction(function () use ($request, $payoutMethod): void {
                $request->user()->payoutMethods()->where('id', '!=', $payoutMethod->id)->update(['is_default' => false]);
                $payoutMethod->update(['is_default' => (bool) $request->boolean('is_default')]);
            });

            return $this->ok($this->methodPayload($payoutMethod->fresh()));
        }

        $this->availability->ensureEnabled();

        $data = $this->validatedMethodData($request, $payoutMethod);
        $this->validateBeneficiaryWithProvider($data, $provider, $environments);
        $result = $this->createPendingMethod($request, $data, $fingerprints, $payoutMethod);
        $this->recordSubmission($request, $result['method'], $result['resubmission'], $result['duplicate'], $notifications, $audit);

        return $this->ok($this->methodPayload($result['method']));
    }

    private function methodPayload(PayoutMethod $method): array
    {
        return [
            'id' => $method->id,
            'account_holder_name' => $method->account_holder_name,
            'account_type' => $method->account_type,
            'entity_type' => $method->entity_type,
            'transfer_method' => $method->transfer_method,
            'country' => $method->country,
            'currency' => $method->currency,
            'masked_account' => $method->maskedAccount(),
            'is_default' => $method->is_default,
            'status' => $method->status,
            'verification_status' => $method->verification_status ?: 'not_submitted',
            'verification_reason' => $method->verification_reason,
            'verification_submitted_at' => $method->verification_submitted_at?->toISOString(),
            'verification_reviewed_at' => $method->verification_reviewed_at?->toISOString(),
            'duplicate_review_required' => $method->duplicate_flagged_at !== null && $method->duplicate_resolved_at === null,
        ];
    }

    private function validatedMethodData(Request $request, ?PayoutMethod $existing = null): array
    {
        $required = $existing ? 'sometimes' : 'required';
        $data = $request->validate([
            'provider' => ['nullable', 'string', 'in:airwallex'],
            'account_holder_name' => [$required, 'string', 'max:160'],
            'account_type' => ['nullable', 'string', 'max:40'],
            'entity_type' => [$required, 'string', 'in:PERSONAL,COMPANY'],
            'transfer_method' => [$required, 'string', 'in:LOCAL,SWIFT'],
            'country' => [$required, 'string', 'size:2'],
            'currency' => [$required, 'string', 'size:3'],
            'routing_details' => ['nullable', 'array'],
            'account_details' => [$required, 'array'],
            'beneficiary_address' => ['nullable', 'array'],
            'is_default' => ['sometimes', 'boolean'],
        ]);
        if ($existing) {
            $data = array_merge($existing->only([
                'provider', 'account_holder_name', 'account_type', 'entity_type', 'transfer_method', 'country', 'currency',
                'routing_details', 'account_details', 'beneficiary_address',
            ]), $data);
        }
        $data['provider'] = $data['provider'] ?? 'airwallex';
        $data['country'] = strtoupper($data['country']);
        $data['currency'] = strtoupper($data['currency']);
        $this->normalizeRouteValues($data, $existing);
        $accountNumber = (string) (data_get($data, 'account_details.account_number') ?: data_get($data, 'account_details.iban') ?: data_get($data, 'account_details.account_identifier'));
        if (strlen($accountNumber) < 4) {
            throw ValidationException::withMessages(['account_details' => 'Provide the account identifier required by the selected bank route.']);
        }
        $data['account_last4'] = substr($accountNumber, -4);

        return $data;
    }

    /** @return array{method: PayoutMethod, resubmission: bool, duplicate: bool} */
    private function createPendingMethod(Request $request, array $data, PayoutIdentifierFingerprintService $fingerprints, ?PayoutMethod $replaced = null): array
    {
        return DB::transaction(function () use ($request, $data, $fingerprints, $replaced): array {
            $user = User::query()->lockForUpdate()->findOrFail($request->user()->id);
            $latest = $user->payoutMethods()->where('status', '!=', 'deleted')->latest('id')->first();
            $resubmission = $replaced?->verification_status === 'changes_requested'
                || $latest?->verification_status === 'changes_requested';

            if ($replaced) {
                $replaced = PayoutMethod::query()->lockForUpdate()->findOrFail($replaced->id);
            }
            $approvedMethods = $user->payoutMethods()
                ->where('status', '!=', 'deleted')
                ->where('verification_status', 'approved')
                ->lockForUpdate()
                ->get();
            foreach ($approvedMethods as $approvedMethod) {
                $approvedMethod->forceFill(['verification_status' => 'superseded', 'is_default' => false])->save();
                DB::table('payout_method_reviews')->insert([
                    'payout_method_id' => $approvedMethod->id,
                    'actor_id' => $user->id,
                    'action' => 'superseded',
                    'from_status' => 'approved',
                    'to_status' => 'superseded',
                    'reason' => 'The member submitted replacement bank details. Existing payout records retain their original bank account reference.',
                    'metadata' => json_encode(['masked_account' => $approvedMethod->maskedAccount()], JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $method = $user->payoutMethods()->create(array_merge($data, [
                'status' => 'pending_review',
                'is_default' => false,
                'verification_status' => 'pending_review',
                'verification_submitted_at' => now(),
                'verification_reason' => null,
                'account_fingerprint' => null,
            ]));
            $fingerprint = $fingerprints->fingerprint($method);
            $method->forceFill(['account_fingerprint' => $fingerprint])->save();

            $matchingMethods = $fingerprint
                ? PayoutMethod::query()
                    ->where('account_fingerprint', $fingerprint)
                    ->where('user_id', '!=', $user->id)
                    ->where('status', '!=', 'deleted')
                    ->lockForUpdate()
                    ->get()
                : collect();
            $duplicate = $matchingMethods->isNotEmpty();
            if ($duplicate) {
                $matchedIds = $matchingMethods->pluck('id')->push($method->id);
                PayoutMethod::query()->whereIn('id', $matchedIds)->update([
                    'duplicate_flagged_at' => DB::raw('COALESCE(duplicate_flagged_at, CURRENT_TIMESTAMP)'),
                ]);
                foreach ($matchedIds as $matchedId) {
                    DB::table('payout_method_reviews')->insert([
                        'payout_method_id' => $matchedId,
                        'action' => 'duplicate_match_detected',
                        'from_status' => 'pending_review',
                        'to_status' => 'pending_review',
                        'reason' => 'Matching payout identifiers require administrator review.',
                        'metadata' => json_encode(['matched_method_count' => $matchedIds->count()], JSON_THROW_ON_ERROR),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            DB::table('payout_method_reviews')->insert([
                'payout_method_id' => $method->id,
                'actor_id' => $user->id,
                'action' => $resubmission ? 'resubmitted' : 'submitted',
                'from_status' => $replaced?->verification_status,
                'to_status' => 'pending_review',
                'metadata' => json_encode(['masked_account' => $method->maskedAccount()], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            if ($batchId = $user->getAttribute('demo_batch_id')) {
                $method->forceFill(['demo_batch_id' => $batchId, 'demo_key' => 'payout-method-'.$method->id])->save();
            }

            return ['method' => $method->fresh(), 'resubmission' => $resubmission, 'duplicate' => $duplicate];
        });
    }

    private function recordSubmission(
        Request $request,
        PayoutMethod $method,
        bool $resubmission,
        bool $duplicate,
        EventNotificationService $notifications,
        AuditLogService $audit,
    ): void {
        $event = $resubmission ? 'payout_verification.resubmitted' : 'payout_verification.submitted';
        $title = $resubmission ? 'Bank account details resubmitted' : 'Bank account details submitted';
        $body = $resubmission
            ? 'Your updated bank account details are back in the administrator review queue.'
            : 'Your bank account details were received and are waiting for administrator review.';
        $notifications->notifyOnce($request->user(), $event.'.member.'.$method->id, new EventNotification(
            $title,
            $body,
            'processing',
            ['event_key' => $event, 'masked_account' => $method->maskedAccount(), 'payout_method_id' => $method->id],
        ), $method->getAttribute('demo_batch_id'));
        $notifications->notifyAdmins($event.'.'.$method->id, new EventNotification(
            $title,
            sprintf('%s submitted bank account details for review.', $request->user()->name),
            'warning',
            ['event_key' => $event, 'member' => $request->user()->name, 'masked_account' => $method->maskedAccount(), 'payout_method_id' => $method->id, 'admin_notification' => true],
        ), $method->getAttribute('demo_batch_id'));
        if ($duplicate) {
            $notifications->notifyAdmins('payout_verification.duplicate.'.$method->id, new EventNotification(
                'Payout information requires review',
                'Submitted payout identifiers match details registered on another account. Review the account records before approving future task access.',
                'warning',
                ['event_key' => 'payout_verification.duplicate', 'payout_method_id' => $method->id, 'admin_notification' => true],
            ), $method->getAttribute('demo_batch_id'));
        }
        $audit->record('payout_method.submitted', $method, $request, after: [
            'verification_status' => $method->verification_status,
            'masked_account' => $method->maskedAccount(),
            'account_fingerprint' => $method->account_fingerprint,
        ], actorId: $request->user()->id);
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
                'provider_error_codes' => $this->providerErrorCodes($exception),
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
                'payout_method' => 'Bank details could not be validated right now. Please try again shortly.',
            ]);
        }
    }

    /** @return list<string> */
    private function providerErrorFields(RequestException $exception): array
    {
        return $this->providerErrors($exception)
            ->pluck('source')
            ->filter(fn (mixed $source): bool => is_string($source) && str_starts_with($source, 'beneficiary.'))
            ->values()
            ->all();
    }

    /** @return list<string> */
    private function providerErrorCodes(RequestException $exception): array
    {
        return $this->providerErrors($exception)
            ->pluck('code')
            ->filter(fn (mixed $code): bool => is_string($code) || is_int($code))
            ->map(fn (string|int $code): string => (string) $code)
            ->values()
            ->all();
    }

    /** @return Collection<int, array<string, mixed>> */
    private function providerErrors(RequestException $exception): Collection
    {
        $payload = $exception->response?->json() ?? [];
        $errors = data_get($payload, 'details.errors', data_get($payload, 'errors', []));

        return collect(Arr::wrap($errors))
            ->filter(fn (mixed $error): bool => is_array($error));
    }

    private function beneficiaryValidationMessage(RequestException $exception): string
    {
        $field = $this->providerErrorFields($exception)[0] ?? null;
        if ($field === null) {
            return 'We could not validate these bank details. Review the required bank fields and try again.';
        }

        $label = str($field)->afterLast('.')->replace('_', ' ')->lower()->toString();

        return 'Update the required bank detail: '.$label.'.';
    }

    /** @param array<string, mixed> $data */
    private function normalizeRouteValues(array &$data, ?PayoutMethod $existing = null): void
    {
        $country = strtoupper((string) ($data['country'] ?? $existing?->country));
        $transferMethod = strtoupper((string) ($data['transfer_method'] ?? $existing?->transfer_method));
        $routing = $data['routing_details'] ?? null;

        if ($country !== 'US' || $transferMethod !== 'LOCAL' || ! is_array($routing) || ! isset($routing['account_routing_type1'])) {
            return;
        }

        // Airwallex validates the US ABA routing type as the schema value "aba".
        $routing['account_routing_type1'] = strtolower((string) $routing['account_routing_type1']);
        $data['routing_details'] = $routing;
    }
}
