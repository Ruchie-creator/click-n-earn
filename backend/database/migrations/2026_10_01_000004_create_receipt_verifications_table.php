<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('receipt_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('proof_submission_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('provider')->default('structured');
            $table->decimal('detected_amount', 12, 2)->nullable();
            $table->date('detected_date')->nullable();
            $table->time('detected_time')->nullable();
            $table->string('detected_reference')->nullable();
            $table->decimal('confidence_score', 5, 2)->nullable();
            $table->boolean('amount_matches')->nullable();
            $table->boolean('date_valid')->nullable();
            $table->boolean('reference_present')->nullable();
            $table->jsonb('warnings')->nullable();
            $table->jsonb('raw_provider_response')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receipt_verifications');
    }
};
