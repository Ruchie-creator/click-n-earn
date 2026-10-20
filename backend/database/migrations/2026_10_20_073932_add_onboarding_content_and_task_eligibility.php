<?php

use App\Models\PayoutMethod;
use App\Services\PayoutIdentifierFingerprintService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $duplicateProofReservation = DB::table('proof_submissions')
            ->select('task_reservation_id')
            ->groupBy('task_reservation_id')
            ->havingRaw('COUNT(*) > 1')
            ->exists();
        if ($duplicateProofReservation) {
            throw new RuntimeException('Cannot enforce one proof per task reservation: existing reservations with multiple proof records must be reviewed first. No proof records were changed.');
        }

        $consumedStatuses = ['proof_submitted', 'under_review', 'changes_requested', 'rejected', 'approved', 'processing', 'payout_failed', 'paid', 'reversed'];
        $duplicateParticipation = DB::table('task_reservations as reservations')
            ->where(function ($query) use ($consumedStatuses): void {
                $query->whereIn('reservations.status', $consumedStatuses)
                    ->orWhereExists(function ($subquery): void {
                        $subquery->selectRaw('1')
                            ->from('proof_submissions')
                            ->whereColumn('proof_submissions.task_reservation_id', 'reservations.id');
                    });
            })
            ->select('reservations.user_id', 'reservations.task_id')
            ->groupBy('reservations.user_id', 'reservations.task_id')
            ->havingRaw('COUNT(*) > 1')
            ->exists();
        if ($duplicateParticipation) {
            throw new RuntimeException('Cannot enforce one qualifying participation per member/task: existing consumed reservations contain duplicates. Review those records before retrying. No reservation or financial records were changed.');
        }

        Schema::create('task_categories', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 80);
            $table->string('slug', 100)->unique();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });
        DB::statement('CREATE UNIQUE INDEX task_categories_lower_name_unique ON task_categories (LOWER(name))');

        $categoryIdsByName = [];
        foreach (DB::table('tasks')->select('category')->distinct()->orderBy('category')->pluck('category') as $categoryName) {
            $name = trim((string) $categoryName);
            if ($name === '') {
                continue;
            }
            $normalizedName = mb_strtolower($name);
            if (isset($categoryIdsByName[$normalizedName])) {
                continue;
            }

            $existing = DB::table('task_categories')->whereRaw('LOWER(name) = ?', [$normalizedName])->first();
            if ($existing) {
                $categoryIdsByName[$normalizedName] = $existing->id;

                continue;
            }

            $baseSlug = Str::slug($name) ?: 'category';
            $slug = $baseSlug;
            $suffix = 2;
            while (DB::table('task_categories')->where('slug', $slug)->exists()) {
                $slug = $baseSlug.'-'.$suffix++;
            }

            $categoryIdsByName[$normalizedName] = DB::table('task_categories')->insertGetId([
                'name' => mb_substr($name, 0, 80),
                'slug' => $slug,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('tasks', function (Blueprint $table): void {
            $table->foreignId('category_id')->nullable()->after('category')->constrained('task_categories')->restrictOnDelete();
        });
        foreach (DB::table('tasks')->select('id', 'category')->orderBy('id')->get() as $task) {
            $categoryId = $categoryIdsByName[mb_strtolower(trim((string) $task->category))] ?? null;
            if ($categoryId) {
                DB::table('tasks')->where('id', $task->id)->update(['category_id' => $categoryId]);
            }
        }

        Schema::create('faq_entries', function (Blueprint $table): void {
            $table->id();
            $table->string('category', 80)->nullable()->index();
            $table->string('question', 240)->unique();
            $table->text('answer');
            $table->boolean('is_published')->default(false)->index();
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $faqs = [
            ['What is Click & Earn?', 'Click & Earn is a task platform. Reserve an available task, follow its instructions, purchase through the external checkout, submit proof, and — once approved — receive the listed reimbursement plus an incentive.'],
            ['How do tasks work?', 'Browse available tasks, review the requirements and reward, and reserve the one you want. Complete it as instructed, upload your proof, and track its status from your account until it is reviewed and paid.'],
            ['Do I need to pay for products myself?', 'Yes. Purchases are made by you through the task’s external checkout; Click & Earn doesn’t process that purchase. The task’s purchase reimbursement is part of your expected payout after your submission is approved.'],
            ['How is my expected payout calculated?', 'Expected payout is the purchase reimbursement plus the incentive, both shown on the task before you reserve it. The amount is paid after your proof is verified.'],
            ['What proof do I need to submit?', 'Each task lists what is required, typically a receipt or other purchase proof. You upload it from your account.'],
            ['How long does review take?', 'Every submission goes through a structured review. Timing can vary, so we don’t promise a specific turnaround — you can follow the status of your task in your account.'],
            ['How do payouts work?', 'After approval, the reimbursement and incentive move to payout processing and are sent to your registered bank account where supported. Payouts aren’t guaranteed to be instant.'],
            ['Can I join without a particular payment account?', 'You do not need to create a separate payment account. Add supported bank details in your profile and wait for administrator review before reserving a task.'],
            ['Can a task expire after I reserve it?', 'A reserved task is held for you to complete, but reservations can have time limits. Check the task details after you reserve so you know what applies.'],
            ['What happens if my proof needs changes?', 'Each task allows one proof submission. Review the task instructions carefully before submitting; if the review team needs to clarify something, they will contact you through your account.'],
        ];
        foreach ($faqs as $index => [$question, $answer]) {
            DB::table('faq_entries')->insert([
                'category' => 'General',
                'question' => $question,
                'answer' => $answer,
                'is_published' => true,
                'sort_order' => $index + 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('payout_methods', function (Blueprint $table): void {
            $table->string('verification_status', 32)->default('pending_review')->index();
            $table->timestamp('verification_submitted_at')->nullable();
            $table->timestamp('verification_reviewed_at')->nullable();
            $table->foreignId('verification_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('verification_reason')->nullable();
            $table->char('account_fingerprint', 64)->nullable()->index();
            $table->timestamp('duplicate_flagged_at')->nullable()->index();
            $table->timestamp('duplicate_resolved_at')->nullable();
            $table->foreignId('duplicate_resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('duplicate_resolution_note')->nullable();
        });
        DB::table('payout_methods')->update([
            'verification_status' => 'pending_review',
            'verification_submitted_at' => DB::raw('created_at'),
        ]);
        $fingerprinter = app(PayoutIdentifierFingerprintService::class);
        DB::table('payout_methods')->select('id')->orderBy('id')->chunkById(250, function ($methods) use ($fingerprinter): void {
            foreach ($methods as $methodRow) {
                $method = PayoutMethod::query()->find($methodRow->id);
                $fingerprint = $method ? $fingerprinter->fingerprint($method) : null;
                if ($fingerprint) {
                    DB::table('payout_methods')->where('id', $methodRow->id)->update(['account_fingerprint' => $fingerprint]);
                }
            }
        });
        $duplicateFingerprints = DB::table('payout_methods')
            ->whereNotNull('account_fingerprint')
            ->select('account_fingerprint')
            ->groupBy('account_fingerprint')
            ->havingRaw('COUNT(DISTINCT user_id) > 1')
            ->pluck('account_fingerprint');
        foreach ($duplicateFingerprints as $fingerprint) {
            DB::table('payout_methods')->where('account_fingerprint', $fingerprint)->update(['duplicate_flagged_at' => now()]);
        }

        Schema::create('payout_method_reviews', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payout_method_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 48);
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->text('reason')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamps();
            $table->index(['payout_method_id', 'created_at']);
        });
        DB::table('payout_methods')->select(['id', 'verification_submitted_at', 'created_at'])->orderBy('id')->chunkById(500, function ($methods): void {
            foreach ($methods as $method) {
                DB::table('payout_method_reviews')->insert([
                    'payout_method_id' => $method->id,
                    'action' => 'submitted',
                    'from_status' => null,
                    'to_status' => 'pending_review',
                    'reason' => 'Existing bank details require administrative review under the account verification rules.',
                    'created_at' => $method->verification_submitted_at ?: $method->created_at,
                    'updated_at' => $method->verification_submitted_at ?: $method->created_at,
                ]);
            }
        });
        foreach ($duplicateFingerprints as $fingerprint) {
            $methodIds = DB::table('payout_methods')->where('account_fingerprint', $fingerprint)->pluck('id');
            foreach ($methodIds as $methodId) {
                DB::table('payout_method_reviews')->insert([
                    'payout_method_id' => $methodId,
                    'action' => 'duplicate_match_detected',
                    'from_status' => 'pending_review',
                    'to_status' => 'pending_review',
                    'reason' => 'Matching payout identifiers require administrator review.',
                    'metadata' => json_encode(['matched_method_count' => $methodIds->count()], JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        Schema::table('task_reservations', function (Blueprint $table): void {
            $table->timestamp('participation_claimed_at')->nullable()->index();
        });
        DB::table('task_reservations')
            ->where(function ($query) use ($consumedStatuses): void {
                $query->whereIn('status', $consumedStatuses)
                    ->orWhereExists(function ($subquery): void {
                        $subquery->selectRaw('1')
                            ->from('proof_submissions')
                            ->whereColumn('proof_submissions.task_reservation_id', 'task_reservations.id');
                    });
            })
            ->update(['participation_claimed_at' => DB::raw('COALESCE(submitted_at, approved_at, completed_at, created_at)')]);

        DB::statement('CREATE UNIQUE INDEX task_reservations_one_consumed_participation_per_user_task_unique ON task_reservations (user_id, task_id) WHERE participation_claimed_at IS NOT NULL');
        DB::statement('CREATE UNIQUE INDEX proof_submissions_one_per_reservation_unique ON proof_submissions (task_reservation_id)');

        Schema::table('referrals', function (Blueprint $table): void {
            $table->foreignId('qualifying_task_reservation_id')->nullable()->constrained('task_reservations')->nullOnDelete();
            $table->unique('qualifying_task_reservation_id');
            $table->timestamp('reward_decided_at')->nullable();
            $table->foreignId('reward_decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reward_hold_reason')->nullable();
            $table->timestamp('self_abuse_flagged_at')->nullable()->index();
            $table->timestamp('self_abuse_resolved_at')->nullable();
            $table->foreignId('self_abuse_resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('self_abuse_note')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('referrals', function (Blueprint $table): void {
            $table->dropForeign(['qualifying_task_reservation_id']);
            $table->dropUnique(['qualifying_task_reservation_id']);
            $table->dropForeign(['reward_decided_by']);
            $table->dropForeign(['self_abuse_resolved_by']);
            $table->dropColumn([
                'qualifying_task_reservation_id', 'reward_decided_at', 'reward_decided_by', 'reward_hold_reason',
                'self_abuse_flagged_at', 'self_abuse_resolved_at', 'self_abuse_resolved_by', 'self_abuse_note',
            ]);
        });
        DB::statement('DROP INDEX IF EXISTS proof_submissions_one_per_reservation_unique');
        DB::statement('DROP INDEX IF EXISTS task_reservations_one_consumed_participation_per_user_task_unique');
        Schema::table('task_reservations', function (Blueprint $table): void {
            $table->dropColumn('participation_claimed_at');
        });
        Schema::dropIfExists('payout_method_reviews');
        Schema::table('payout_methods', function (Blueprint $table): void {
            $table->dropForeign(['verification_reviewed_by']);
            $table->dropForeign(['duplicate_resolved_by']);
            $table->dropColumn([
                'verification_status', 'verification_submitted_at', 'verification_reviewed_at', 'verification_reviewed_by',
                'verification_reason', 'account_fingerprint', 'duplicate_flagged_at', 'duplicate_resolved_at',
                'duplicate_resolved_by', 'duplicate_resolution_note',
            ]);
        });
        Schema::dropIfExists('faq_entries');
        Schema::table('tasks', function (Blueprint $table): void {
            $table->dropForeign(['category_id']);
            $table->dropColumn('category_id');
        });
        DB::statement('DROP INDEX IF EXISTS task_categories_lower_name_unique');
        Schema::dropIfExists('task_categories');
    }
};
