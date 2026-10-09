<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add an explicit, foreign-keyed marker to demo-owned records. Cleanup
     * always scopes to one batch UUID and never infers demo status by name.
     */
    public function up(): void
    {
        Schema::create('demo_batches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('slug')->unique();
            $table->string('label');
            $table->jsonb('metadata')->nullable();
            $table->timestamps();
        });

        $tables = [
            'users',
            'tasks',
            'task_reservations',
            'proof_submissions',
            'receipt_verifications',
            'referrals',
            'payout_methods',
            'payouts',
            'ledger_entries',
            'audit_logs',
            'status_histories',
            'notifications',
            'notification_outbox',
        ];

        foreach ($tables as $name) {
            Schema::table($name, function (Blueprint $table) use ($name): void {
                $table->uuid('demo_batch_id')->nullable();
                $table->foreign('demo_batch_id', $name.'_demo_batch_fk')
                    ->references('id')
                    ->on('demo_batches')
                    ->nullOnDelete();
                $table->index('demo_batch_id', $name.'_demo_batch_idx');
            });
        }

        foreach ([
            'users',
            'tasks',
            'task_reservations',
            'proof_submissions',
            'referrals',
            'payout_methods',
            'payouts',
        ] as $name) {
            Schema::table($name, function (Blueprint $table) use ($name): void {
                $table->string('demo_key', 120)->nullable();
                $table->unique(['demo_batch_id', 'demo_key'], $name.'_demo_batch_key_unique');
            });
        }
    }

    public function down(): void
    {
        foreach ([
            'users',
            'tasks',
            'task_reservations',
            'proof_submissions',
            'referrals',
            'payout_methods',
            'payouts',
        ] as $name) {
            Schema::table($name, function (Blueprint $table) use ($name): void {
                $table->dropUnique($name.'_demo_batch_key_unique');
                $table->dropColumn('demo_key');
            });
        }

        foreach ([
            'users',
            'tasks',
            'task_reservations',
            'proof_submissions',
            'receipt_verifications',
            'referrals',
            'payout_methods',
            'payouts',
            'ledger_entries',
            'audit_logs',
            'status_histories',
            'notifications',
            'notification_outbox',
        ] as $name) {
            Schema::table($name, function (Blueprint $table) use ($name): void {
                $table->dropForeign($name.'_demo_batch_fk');
                $table->dropIndex($name.'_demo_batch_idx');
                $table->dropColumn('demo_batch_id');
            });
        }

        Schema::dropIfExists('demo_batches');
    }
};
