<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('task_reservation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('referral_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payout_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type')->index();
            $table->decimal('amount', 12, 2);
            $table->string('direction');
            $table->string('status')->index();
            $table->string('reference')->unique();
            $table->jsonb('metadata')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
    }
};
