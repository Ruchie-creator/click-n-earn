<?php

namespace App\Services;

use App\Models\Setting;

class BankAccountRequirement
{
    public const SETTING_KEY = 'onboarding.require_bank_account';

    /**
     * Missing or malformed values intentionally retain the historic behavior.
     */
    public function isRequired(): bool
    {
        $value = Setting::query()->where('key', self::SETTING_KEY)->value('value');

        return data_get($value, 'enabled', true) === true;
    }
}
