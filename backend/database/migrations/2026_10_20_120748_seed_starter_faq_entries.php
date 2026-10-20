<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::table('faq_entries')->count() >= 5) {
            return;
        }

        $entries = [
            ['Getting Started', 'How does Click & Earn work?', 'Create an account, choose an available task, review its requirements and reward, and reserve it before completing the purchase through the task’s external checkout. Submit the requested proof in your account and track its review and payout status.'],
            ['Tasks', 'What types of online tasks can I complete?', 'Available tasks can include eligible digital products, services, subscriptions, or other online purchase opportunities. Each task page explains what to purchase, how to complete it, the proof required, and the reimbursement and incentive offered.'],
            ['Rewards', 'How are task reimbursements and incentives calculated?', 'Each task shows the purchase reimbursement and the additional incentive before you reserve it. Together they make up the expected payout, subject to completing the task correctly and passing proof verification.'],
            ['Verification', 'What proof is required after completing a task?', 'The task instructions specify the required proof, which may include a receipt, order confirmation, transaction reference, or another document showing that the task was completed. Review the requirements carefully before submitting because each task allows one proof submission.'],
            ['Payouts', 'How do I receive an approved Click & Earn payout?', 'Add a supported bank account to your profile and wait for administrator approval. After your task proof is approved, the reimbursement and incentive move through payout processing and can be sent to your approved bank account.'],
            ['Account', 'Why must my bank account be reviewed before I reserve tasks?', 'Bank account review helps confirm that payout details are complete and suitable for supported transfers. You can track the review status in your account and update the details if the administrator requests changes.'],
            ['Timing', 'How long do task review and payout processing take?', 'Review and payout timing can vary by task and payment route. Click & Earn does not promise an exact turnaround, but your account shows each task’s current status from reservation through verification and payout.'],
            ['Rewards', 'Are earnings or payouts guaranteed?', 'No. Task availability and earnings are not guaranteed. A payout depends on meeting the task requirements, submitting valid proof, passing verification, and remaining eligible under the task terms.'],
        ];

        $now = now();
        DB::table('faq_entries')->insertOrIgnore(array_map(
            fn (array $entry, int $index): array => [
                'category' => $entry[0],
                'question' => $entry[1],
                'answer' => $entry[2],
                'is_published' => true,
                'sort_order' => $index + 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            $entries,
            array_keys($entries),
        ));
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {}
};
