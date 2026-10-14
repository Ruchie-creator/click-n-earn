<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class ClientErrorLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_authenticated_member_can_safely_record_a_client_error(): void
    {
        Log::spy();
        $member = User::factory()->create();

        $this->actingAs($member, 'sanctum')
            ->postJson('/api/client-errors', [
                'kind' => 'render',
                'message' => 'Cannot read properties of undefined.',
                'stack' => 'Error: Cannot read properties of undefined.\n    at PayoutsPage',
                'page' => '/payouts',
            ])
            ->assertAccepted()
            ->assertJsonPath('message', 'Client error recorded.');

        Log::shouldHaveReceived('error')
            ->once()
            ->withArgs(fn (string $message, array $context): bool => $message === 'Client application error.'
                && $context['user_id'] === $member->id
                && $context['kind'] === 'render'
                && $context['page'] === '/payouts');
    }

    public function test_client_error_endpoint_rejects_urls_or_other_unexpected_payload_values(): void
    {
        $member = User::factory()->create();

        $this->actingAs($member, 'sanctum')
            ->postJson('/api/client-errors', [
                'kind' => 'render',
                'message' => 'Test',
                'page' => 'https://example.test/payouts?account=private',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('page');
    }
}
