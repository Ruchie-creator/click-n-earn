<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $invalidTasks = DB::table('tasks')
            ->whereRaw('reserved_slots < 0 OR completed_slots < 0 OR reserved_slots + completed_slots > available_slots')
            ->count();
        if ($invalidTasks > 0) {
            throw new RuntimeException('Cannot add task capacity constraints: existing tasks exceed their configured slot capacity. Reconcile those rows before retrying this migration.');
        }

        foreach ([
            ['payouts', 'task_reservation_id'],
            ['payouts', 'referral_id'],
        ] as [$table, $column]) {
            $duplicates = DB::table($table)
                ->whereNotNull($column)
                ->select($column)
                ->groupBy($column)
                ->havingRaw('COUNT(*) > 1')
                ->exists();
            if ($duplicates) {
                throw new RuntimeException("Cannot add one-payout-per-{$column} constraint: duplicate existing payout links must be reviewed first.");
            }
        }

        $ownerMismatches = DB::table('proof_submissions as proofs')
            ->join('task_reservations as reservations', 'reservations.id', '=', 'proofs.task_reservation_id')
            ->whereColumn('proofs.user_id', '!=', 'reservations.user_id')
            ->count();
        if ($ownerMismatches > 0) {
            throw new RuntimeException('Cannot add proof ownership constraints: existing proof/reservation owner mismatches must be reviewed first.');
        }

        Schema::table('tasks', function (Blueprint $table): void {
            $table->index(['status', 'available_slots', 'reserved_slots', 'completed_slots'], 'tasks_capacity_lookup');
        });
        DB::statement('ALTER TABLE tasks ADD CONSTRAINT tasks_capacity_within_slots CHECK (reserved_slots >= 0 AND completed_slots >= 0 AND reserved_slots + completed_slots <= available_slots)');
        DB::statement('ALTER TABLE tasks ADD CONSTRAINT tasks_nonnegative_economics CHECK (reimbursement_amount >= 0 AND incentive_amount >= 0 AND expected_payout >= 0)');
        DB::statement('ALTER TABLE task_reservations ADD CONSTRAINT task_reservations_nonnegative_economics CHECK (reimbursement_amount >= 0 AND incentive_amount >= 0 AND expected_payout >= 0)');
        DB::statement('ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_nonnegative_amount CHECK (amount >= 0)');
        DB::statement('ALTER TABLE payouts ADD CONSTRAINT payouts_positive_amount CHECK (amount > 0)');

        DB::statement('DROP INDEX IF EXISTS task_reservations_active_user_task_unique');
        DB::statement("CREATE UNIQUE INDEX task_reservations_active_user_task_unique
            ON task_reservations (user_id, task_id)
            WHERE status IN ('reserved', 'proof_submitted', 'under_review', 'changes_requested', 'approved', 'processing', 'payout_failed')");

        Schema::table('proof_submissions', function (Blueprint $table): void {
            $table->boolean('is_current')->default(false);
            $table->string('idempotency_key', 128)->nullable();
            $table->char('request_fingerprint', 64)->nullable();
            $table->char('transaction_reference_key', 64)->nullable();
        });

        DB::statement('UPDATE proof_submissions SET is_current = TRUE WHERE id IN (SELECT MAX(id) FROM proof_submissions GROUP BY task_reservation_id)');

        DB::table('proof_submissions')->select(['id', 'transaction_reference', 'file_sha256'])->orderBy('id')->chunkById(500, function ($rows): void {
            foreach ($rows as $row) {
                $reference = preg_replace('/\s+/', ' ', mb_strtolower(trim((string) $row->transaction_reference)));
                DB::table('proof_submissions')->where('id', $row->id)->update([
                    'transaction_reference_key' => hash('sha256', $reference),
                    'file_sha256' => strtolower((string) $row->file_sha256),
                ]);
            }
        });

        $duplicateCurrentHashes = DB::table('proof_submissions')
            ->where('is_current', true)
            ->select('file_sha256')
            ->groupBy('file_sha256')
            ->havingRaw('COUNT(*) > 1')
            ->exists();
        $duplicateCurrentReferences = DB::table('proof_submissions')
            ->where('is_current', true)
            ->select('transaction_reference_key')
            ->groupBy('transaction_reference_key')
            ->havingRaw('COUNT(*) > 1')
            ->exists();
        if ($duplicateCurrentHashes || $duplicateCurrentReferences) {
            throw new RuntimeException('Cannot add proof de-duplication constraints: current proof submissions contain duplicate file hashes or transaction references. Review and resolve those records before retrying this migration.');
        }

        DB::statement('ALTER TABLE task_reservations ADD CONSTRAINT task_reservations_id_user_unique UNIQUE (id, user_id)');
        DB::statement('ALTER TABLE proof_submissions ADD CONSTRAINT proof_submissions_reservation_owner_fk FOREIGN KEY (task_reservation_id, user_id) REFERENCES task_reservations (id, user_id) ON DELETE CASCADE');
        DB::statement('CREATE UNIQUE INDEX proof_submissions_one_current_per_reservation_unique ON proof_submissions (task_reservation_id) WHERE is_current');
        DB::statement('CREATE UNIQUE INDEX proof_submissions_current_file_sha256_unique ON proof_submissions (file_sha256) WHERE is_current');
        DB::statement('CREATE UNIQUE INDEX proof_submissions_current_reference_key_unique ON proof_submissions (transaction_reference_key) WHERE is_current');
        DB::statement('CREATE UNIQUE INDEX proof_submissions_user_idempotency_unique ON proof_submissions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL');
        DB::statement('CREATE UNIQUE INDEX payouts_one_per_reservation_unique ON payouts (task_reservation_id) WHERE task_reservation_id IS NOT NULL');
        DB::statement('CREATE UNIQUE INDEX payouts_one_per_referral_unique ON payouts (referral_id) WHERE referral_id IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS payouts_one_per_referral_unique');
        DB::statement('DROP INDEX IF EXISTS payouts_one_per_reservation_unique');
        DB::statement('DROP INDEX IF EXISTS proof_submissions_user_idempotency_unique');
        DB::statement('DROP INDEX IF EXISTS proof_submissions_current_reference_key_unique');
        DB::statement('DROP INDEX IF EXISTS proof_submissions_current_file_sha256_unique');
        DB::statement('DROP INDEX IF EXISTS proof_submissions_one_current_per_reservation_unique');
        DB::statement('ALTER TABLE proof_submissions DROP CONSTRAINT IF EXISTS proof_submissions_reservation_owner_fk');
        DB::statement('ALTER TABLE task_reservations DROP CONSTRAINT IF EXISTS task_reservations_id_user_unique');
        DB::statement('DROP INDEX IF EXISTS task_reservations_active_user_task_unique');
        DB::statement("CREATE UNIQUE INDEX task_reservations_active_user_task_unique
            ON task_reservations (user_id, task_id)
            WHERE status IN ('reserved', 'proof_submitted', 'under_review', 'changes_requested', 'approved', 'processing')");
        DB::statement('ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_positive_amount');
        DB::statement('ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_nonnegative_amount');
        DB::statement('ALTER TABLE task_reservations DROP CONSTRAINT IF EXISTS task_reservations_nonnegative_economics');
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_nonnegative_economics');
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_capacity_within_slots');
        Schema::table('tasks', function (Blueprint $table): void {
            $table->dropIndex('tasks_capacity_lookup');
        });
        Schema::table('proof_submissions', function (Blueprint $table): void {
            $table->dropColumn(['is_current', 'idempotency_key', 'request_fingerprint', 'transaction_reference_key']);
        });
    }
};
