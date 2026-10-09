<?php

namespace Tests\Unit;

use App\Support\Money;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_money_is_added_using_cents(): void
    {
        $this->assertSame('57.00', Money::add('47.00', '10.00'));
        $this->assertSame(4750, Money::toCents('47.50'));
    }
}
