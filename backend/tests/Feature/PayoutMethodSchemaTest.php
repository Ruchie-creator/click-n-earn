<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PayoutMethodSchemaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'payout.airwallex.environment' => 'sandbox',
            'payout.airwallex.sandbox.base_url' => 'https://api.sandbox.airwallex.com/api/v1',
            'payout.airwallex.sandbox.client_id' => 'sandbox-client',
            'payout.airwallex.sandbox.api_key' => 'sandbox-key',
        ]);
    }

    public function test_member_receives_airwallex_schema_for_the_selected_bank_route(): void
    {
        Http::fake([
            'https://api.sandbox.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'sandbox-token'], 201),
            'https://api.sandbox.airwallex.com/api/v1/beneficiary_form_schemas/generate' => Http::response([
                'fields' => [[
                    'key' => 'account_routing_type1',
                    'path' => 'beneficiary.bank_details.account_routing_type1',
                    'required' => true,
                    'field' => [
                        'type' => 'SELECT',
                        'default' => 'ABA',
                        'options' => [['label' => 'ABA routing number', 'value' => 'ABA']],
                    ],
                ]],
            ]),
        ]);

        $member = User::factory()->create();

        $this->actingAs($member, 'sanctum')
            ->getJson('/api/payout-methods/schema?country=US&currency=USD&entity_type=PERSONAL&transfer_method=LOCAL&local_clearing_system=ACH')
            ->assertOk()
            ->assertJsonPath('data.fields.0.path', 'beneficiary.bank_details.account_routing_type1')
            ->assertJsonPath('data.fields.0.field.default', 'ABA');

        Http::assertSent(function ($request): bool {
            return str_ends_with($request->url(), '/beneficiary_form_schemas/generate')
                && $request['local_clearing_system'] === 'ACH'
                && $request['entity_type'] === 'PERSONAL';
        });
    }

    public function test_member_receives_the_airwallex_supported_destination_country_list(): void
    {
        Http::fake([
            'https://api.sandbox.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'sandbox-token'], 201),
            'https://api.sandbox.airwallex.com/api/v1/beneficiary_form_schemas/generate' => Http::response([
                'fields' => [[
                    'key' => 'bank_country_code',
                    'path' => 'beneficiary.bank_details.bank_country_code',
                    'field' => ['type' => 'SELECT', 'options' => [
                        ['label' => 'United Kingdom', 'value' => 'GB'],
                        ['label' => 'Kenya', 'value' => 'KE'],
                        ['label' => 'United States', 'value' => 'US'],
                    ]],
                ]],
            ]),
        ]);

        $member = User::factory()->create();

        $this->actingAs($member, 'sanctum')
            ->getJson('/api/payout-methods/countries')
            ->assertOk()
            ->assertJsonPath('data.countries', ['GB', 'KE', 'US']);

        Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/beneficiary_form_schemas/generate')
            && $request['type'] === 'BANK_ACCOUNT');
    }

    public function test_provider_schema_failure_is_a_clear_validation_response_not_a_server_error(): void
    {
        Http::fake([
            'https://api.sandbox.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'sandbox-token'], 201),
            'https://api.sandbox.airwallex.com/api/v1/beneficiary_form_schemas/generate' => Http::response(['code' => 'validation_failed'], 400),
        ]);

        $member = User::factory()->create();

        $this->actingAs($member, 'sanctum')
            ->getJson('/api/payout-methods/schema?country=US&currency=USD&entity_type=PERSONAL&transfer_method=LOCAL&local_clearing_system=ACH')
            ->assertUnprocessable()
            ->assertJsonPath('errors.payout_method.0', 'Airwallex could not load requirements for this bank route. Check the country, currency, and local clearing system, then try again.');
    }

    public function test_payout_method_is_validated_with_airwallex_before_it_is_saved(): void
    {
        Http::fake([
            'https://api.sandbox.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'sandbox-token'], 201),
            'https://api.sandbox.airwallex.com/api/v1/beneficiaries/validate' => function ($request) {
                $this->assertSame('ABA', $request['beneficiary']['bank_details']['account_routing_type1']);
                $this->assertSame('021000021', $request['beneficiary']['bank_details']['account_routing_value1']);

                return Http::response([], 200);
            },
        ]);

        $member = User::factory()->create();

        $this->actingAs($member, 'sanctum')
            ->postJson('/api/payout-methods', [
                'account_holder_name' => 'John Walker',
                'entity_type' => 'PERSONAL',
                'transfer_method' => 'LOCAL',
                'country' => 'US',
                'currency' => 'USD',
                'routing_details' => [
                    'local_clearing_system' => 'ACH',
                    'bank_account_category' => 'CHECKING',
                    'account_routing_type1' => 'ABA',
                    'account_routing_value1' => '021000021',
                ],
                'account_details' => ['account_number' => '50001121', 'type' => 'BANK_ACCOUNT'],
                'beneficiary_address' => ['country_code' => 'US', 'state' => 'US-WA', 'city' => 'Seattle', 'postcode' => '98104', 'street_address' => '412 5th Avenue'],
            ])
            ->assertCreated();
    }

    public function test_invalid_beneficiary_data_is_rejected_when_saving_the_method(): void
    {
        Http::fake([
            'https://api.sandbox.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'sandbox-token'], 201),
            'https://api.sandbox.airwallex.com/api/v1/beneficiaries/validate' => Http::response([
                'code' => 'validation_failed',
                'errors' => [['source' => 'beneficiary.bank_details.account_routing_type1']],
            ], 400),
        ]);

        $member = User::factory()->create();

        $this->actingAs($member, 'sanctum')
            ->postJson('/api/payout-methods', [
                'account_holder_name' => 'John Walker',
                'entity_type' => 'PERSONAL',
                'transfer_method' => 'LOCAL',
                'country' => 'US',
                'currency' => 'USD',
                'account_details' => ['account_number' => '50001121', 'type' => 'BANK_ACCOUNT'],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.payout_method.0', 'Update the required bank detail: account routing type1.');
    }
}
