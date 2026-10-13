<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payout_methods', function (Blueprint $table): void {
            $table->string('entity_type', 16)->default('PERSONAL')->after('provider');
            $table->string('transfer_method', 16)->default('LOCAL')->after('currency');
            $table->text('beneficiary_address')->nullable()->after('account_details');
            $table->text('provider_beneficiaries')->nullable()->after('provider_beneficiary_id');
        });

        Schema::table('payouts', function (Blueprint $table): void {
            $table->string('provider_environment', 16)->default('sandbox')->after('provider');
            $table->string('provider_request_id')->nullable()->unique()->after('provider_reference');
            $table->index(['provider', 'provider_environment', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('payouts', function (Blueprint $table): void {
            $table->dropIndex(['provider', 'provider_environment', 'status']);
            $table->dropUnique(['provider_request_id']);
            $table->dropColumn(['provider_environment', 'provider_request_id']);
        });
        Schema::table('payout_methods', function (Blueprint $table): void {
            $table->dropColumn(['entity_type', 'transfer_method', 'beneficiary_address', 'provider_beneficiaries']);
        });
    }
};
