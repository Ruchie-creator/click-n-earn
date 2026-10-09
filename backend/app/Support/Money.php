<?php

namespace App\Support;

use InvalidArgumentException;

final class Money
{
    public static function toCents(string|int|float|null $value): int
    {
        if ($value === null || $value === '') {
            throw new InvalidArgumentException('Money value is required.');
        }

        $normalized = number_format((float) $value, 2, '.', '');
        [$whole, $fraction] = array_pad(explode('.', $normalized, 2), 2, '00');

        return ((int) $whole * 100) + (int) str_pad($fraction, 2, '0');
    }

    public static function decimal(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }

    public static function add(string|int|float ...$values): string
    {
        return self::decimal(array_sum(array_map(self::toCents(...), $values)));
    }
}
