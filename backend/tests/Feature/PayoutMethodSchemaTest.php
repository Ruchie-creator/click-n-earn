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
            'https://api.sandbox.airwallex.com/api/v1/beneficiary_api_schemas/generate' => Http::response([
                'fields' => [[
                    'key' => 'bank_account_category',
                    'path' => 'beneficiary.bank_details.bank_account_category',
                    'required' => true,
                ]],
            ]),
        ]);

        $member = User::factory()->create();

        $this->actingAs($member, 'sanctum')
            ->getJson('/api/payout-methods/schema?country=US&currency=USD&entity_type=PERSONAL&transfer_method=LOCAL&local_clearing_system=ACH')
            ->assertOk()
            ->assertJsonPath('data.fields.0.path', 'beneficiary.bank_details.bank_account_category')
            ->assertJsonPath('data.fields.0.required', true);

        Http::assertSent(function ($request): bool {
            return str_ends_with($request->url(), '/beneficiary_api_schemas/generate')
                && $request['local_clearing_system'] === 'ACH'
                && $request['entity_type'] === 'PERSONAL';
        });
    }

    public function test_provider_schema_failure_is_a_clear_validation_response_not_a_server_error(): void
    {
        Http::fake([
            'https://api.sandbox.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'sandbox-token'], 201),
            'https://api.sandbox.airwallex.com/api/v1/beneficiary_api_schemas/generate' => Http::response(['code' => 'validation_failed'], 400),
        ]);

        $member = User::factory()->create();

        $this->actingAs($member, 'sanctum')
            ->getJson('/api/payout-methods/schema?country=US&currency=USD&entity_type=PERSONAL&transfer_method=LOCAL&local_clearing_system=ACH')
            ->assertUnprocessable()
            ->assertJsonPath('errors.payout_method.0', 'Airwallex could not load requirements for this bank route. Check the country, currency, and local clearing system, then try again.');
    }
}
