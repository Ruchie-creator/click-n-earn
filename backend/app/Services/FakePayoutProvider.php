<?php

namespace App\Services;

use App\Models\Payout;
use App\Models\PayoutMethod;
use Illuminate\Support\Str;

class FakePayoutProvider implements PayoutProviderInterface
{
    public function submit(Payout $payout, PayoutMethod $method): PayoutResult
    {
        $outcome = config('payout.fake_outcome', 'processing');
        $reference = 'FAKE-'.strtoupper(Str::random(10));

        return match ($outcome) {
            'paid', 'success' => new PayoutResult('paid', $reference, 'Fake payout marked paid.', [
                'driver' => 'fake',
                'outcome' => $outcome,
            ]),
            'failed', 'failure' => new PayoutResult('failed', $reference, 'Fake payout failure configured.', [
                'driver' => 'fake',
                'outcome' => $outcome,
            ]),
            default => new PayoutResult('processing', $reference, 'Fake payout accepted for processing.', [
                'driver' => 'fake',
                'outcome' => 'processing',
            ]),
        };
    }

    public function retrieve(Payout $payout): PayoutResult
    {
        $reference = $payout->provider_reference ?: 'FAKE-'.strtoupper(Str::random(10));
        $outcome = config('payout.fake_outcome', 'processing');

        return new PayoutResult(
            in_array($outcome, ['paid', 'success'], true) ? 'paid' : ($outcome === 'failed' ? 'failed' : 'processing'),
            $reference,
            'Fake payout status retrieved.',
            ['driver' => 'fake', 'outcome' => $outcome],
        );
    }
}
