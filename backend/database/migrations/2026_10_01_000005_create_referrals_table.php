<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('referrals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referrer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('referred_user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('referral_code')->index();
            $table->timestamp('registered_at');
            $table->timestamp('qualified_at')->nullable();
            $table->decimal('reward_amount', 12, 2);
            $table->string('reward_status')->default('pending')->index();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->unique(['referrer_id', 'referred_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referrals');
    }
};
