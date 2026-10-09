<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->decimal('reimbursement_amount', 12, 2);
            $table->decimal('incentive_amount', 12, 2);
            $table->decimal('expected_payout', 12, 2);
            $table->string('status')->default('reserved')->index();
            $table->timestamp('reserved_at');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
            $table->index(['task_id', 'status']);
        });

        DB::statement(
            "CREATE UNIQUE INDEX task_reservations_active_user_task_unique
             ON task_reservations (user_id, task_id)
             WHERE status IN ('reserved', 'proof_submitted', 'under_review', 'changes_requested', 'approved', 'processing')"
        );
        DB::statement(
            'ALTER TABLE task_reservations ADD CONSTRAINT task_reservations_expected_payout_matches CHECK (expected_payout = reimbursement_amount + incentive_amount)'
        );
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE task_reservations DROP CONSTRAINT IF EXISTS task_reservations_expected_payout_matches');
        DB::statement('DROP INDEX IF EXISTS task_reservations_active_user_task_unique');
        Schema::dropIfExists('task_reservations');
    }
};
