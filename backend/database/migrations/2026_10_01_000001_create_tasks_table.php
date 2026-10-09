<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description');
            $table->string('category')->index();
            $table->string('image_path')->nullable();
            $table->text('external_checkout_url');
            $table->decimal('reimbursement_amount', 12, 2);
            $table->decimal('incentive_amount', 12, 2);
            $table->decimal('expected_payout', 12, 2);
            $table->unsignedInteger('available_slots');
            $table->unsignedInteger('reserved_slots')->default(0);
            $table->unsignedInteger('completed_slots')->default(0);
            $table->jsonb('instructions');
            $table->jsonb('proof_requirements');
            $table->string('status')->default('available')->index();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->index(['status', 'category']);
        });

        DB::statement(
            'ALTER TABLE tasks ADD CONSTRAINT tasks_expected_payout_matches CHECK (expected_payout = reimbursement_amount + incentive_amount)'
        );
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_expected_payout_matches');
        Schema::dropIfExists('tasks');
    }
};
