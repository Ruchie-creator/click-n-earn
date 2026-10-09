<?php

namespace App\Services;

use App\Models\Payout;
use App\Models\PayoutMethod;

interface PayoutProviderInterface
{
    public function submit(Payout $payout, PayoutMethod $method): PayoutResult;

    public function retrieve(Payout $payout): PayoutResult;
}
