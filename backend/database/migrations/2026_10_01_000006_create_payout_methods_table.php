<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payout_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider')->default('airwallex');
            $table->string('account_holder_name');
            $table->string('account_type')->nullable();
            $table->string('country', 2);
            $table->string('currency', 3);
            $table->text('routing_details')->nullable();
            $table->text('account_details')->nullable();
            $table->string('account_last4', 4);
            $table->string('provider_beneficiary_id')->nullable()->index();
            $table->string('status')->default('active')->index();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payout_methods');
    }
};
