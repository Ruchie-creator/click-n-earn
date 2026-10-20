<?php

namespace Database\Seeders;

use App\Models\FaqEntry;
use Illuminate\Database\Seeder;

class FaqSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $entries = [
            ['What is Click & Earn?', 'Click & Earn is a task platform. Reserve an available task, follow its instructions, purchase through the external checkout, submit proof, and — once approved — receive the listed reimbursement plus an incentive.'],
            ['How do tasks work?', 'Browse available tasks, review the requirements and reward, and reserve the one you want. Complete it as instructed, upload your proof, and track its status from your account until it is reviewed and paid.'],
            ['Do I need to pay for products myself?', 'Yes. Purchases are made by you through the task’s external checkout; Click & Earn does not process that purchase. The task’s purchase reimbursement is part of your expected payout after your submission is approved.'],
            ['How is my expected payout calculated?', 'Expected payout is the purchase reimbursement plus the incentive, both shown on the task before you reserve it. The amount is paid after your proof is verified.'],
            ['What proof do I need to submit?', 'Each task lists what is required, typically a receipt or other purchase proof. You upload it from your account.'],
            ['How long does review take?', 'Every submission goes through a structured review. Timing can vary, so we do not promise a specific turnaround — you can follow the status of your task in your account.'],
            ['How do payouts work?', 'After approval, the reimbursement and incentive move to payout processing and are sent to your registered bank account where supported. Payouts are not guaranteed to be instant.'],
            ['Can I join without a particular payment account?', 'You do not need to create a separate payment account. Add supported bank details in your profile and wait for administrator review before reserving a task.'],
            ['Can a task expire after I reserve it?', 'A reserved task is held for you to complete, but reservations can have time limits. Check the task details after you reserve so you know what applies.'],
            ['What happens if my proof needs changes?', 'Each task allows one proof submission. Review the task instructions carefully before submitting; if the review team needs to clarify something, they will contact you through your account.'],
        ];

        foreach ($entries as $index => [$question, $answer]) {
            FaqEntry::query()->updateOrCreate(
                ['question' => $question],
                ['category' => 'General', 'answer' => $answer, 'is_published' => true, 'sort_order' => $index + 1],
            );
        }
    }
}
