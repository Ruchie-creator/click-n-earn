<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proof_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_reservation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('previous_submission_id')->nullable()->constrained('proof_submissions')->nullOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->string('file_disk')->default('local');
            $table->string('file_path');
            $table->string('original_file_name');
            $table->string('mime_type');
            $table->unsignedBigInteger('file_size');
            $table->string('file_sha256', 64)->index();
            $table->decimal('purchase_amount', 12, 2);
            $table->date('purchase_date');
            $table->time('purchase_time')->nullable();
            $table->string('transaction_reference')->index();
            $table->text('user_note')->nullable();
            $table->string('status')->default('proof_submitted')->index();
            $table->timestamp('submitted_at');
            $table->timestamps();
            $table->index(['task_reservation_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proof_submissions');
    }
};
