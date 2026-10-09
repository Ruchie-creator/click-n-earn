<?php

namespace Tests\Unit;

use App\Models\Payout;
use App\Models\PayoutMethod;
use App\Services\FakePayoutProvider;
use Tests\TestCase;

class FakePayoutProviderTest extends TestCase
{
    public function test_fake_provider_supports_processing_paid_and_failed_outcomes(): void
    {
        $provider = new FakePayoutProvider();
        $payout = new Payout(['amount' => 57, 'currency' => 'USD', 'idempotency_key' => 'test-payout']);
        $method = new PayoutMethod(['account_holder_name' => 'Jordan Davis', 'account_last4' => '4219']);

        config(['payout.fake_outcome' => 'processing']);
        $this->assertSame('processing', $provider->submit($payout, $method)->status);

        config(['payout.fake_outcome' => 'paid']);
        $this->assertSame('paid', $provider->submit($payout, $method)->status);

        config(['payout.fake_outcome' => 'failed']);
        $this->assertSame('failed', $provider->submit($payout, $method)->status);
    }
}
