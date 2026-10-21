<?php

use App\Services\BankAccountRequirement;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! DB::table('settings')->where('key', BankAccountRequirement::SETTING_KEY)->exists()) {
            DB::table('settings')->insert([
                'key' => BankAccountRequirement::SETTING_KEY,
                'value' => json_encode(['enabled' => true], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('settings')->where('key', BankAccountRequirement::SETTING_KEY)->delete();
    }
};
