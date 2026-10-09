<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('task_reservation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('referral_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payout_method_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider')->default('fake');
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('USD');
            $table->string('status')->default('approved')->index();
            $table->string('provider_reference')->nullable()->unique();
            $table->string('idempotency_key')->unique();
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('processing_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->string('manual_reference')->nullable();
            $table->text('manual_note')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
            $table->index(['task_reservation_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payouts');
    }
};
