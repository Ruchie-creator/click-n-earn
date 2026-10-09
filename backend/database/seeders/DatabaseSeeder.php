<?php

namespace Database\Seeders;

use App\Enums\AccountStatus;
use App\Enums\LedgerStatus;
use App\Enums\PayoutStatus;
use App\Enums\ReservationStatus;
use App\Enums\UserRole;
use App\Models\Payout;
use App\Models\PayoutMethod;
use App\Models\ProofSubmission;
use App\Models\ReceiptVerification;
use App\Models\Referral;
use App\Models\Setting;
use App\Models\StatusHistory;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use App\Notifications\EventNotification;
use App\Services\LedgerService;
use App\Support\Money;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local') && ! app()->environment('testing')) {
            throw new RuntimeException('The Click & Earn demo seeder is restricted to local development and automated tests.');
        }

        $admin = User::updateOrCreate(
            ['email' => 'admin@clickandearn.test'],
            [
                'name' => 'Olivia Wilson',
                'password' => Hash::make('password'),
                'role' => UserRole::SUPER_ADMIN,
                'account_status' => AccountStatus::ACTIVE,
                'country' => 'US',
                'referral_code' => 'OLIVIA12',
                'email_verified_at' => now(),
            ],
        );
        $member = User::updateOrCreate(
            ['email' => 'jordan@example.com'],
            [
                'name' => 'Jordan Davis',
                'password' => Hash::make('password'),
                'role' => UserRole::MEMBER,
                'account_status' => AccountStatus::ACTIVE,
                'country' => 'US',
                'referral_code' => 'JORDAN12',
                'email_verified_at' => now(),
            ],
        );
        $maya = User::updateOrCreate(
            ['email' => 'maya@example.com'],
            [
                'name' => 'Maya King',
                'password' => Hash::make('password'),
                'role' => UserRole::MEMBER,
                'account_status' => AccountStatus::ACTIVE,
                'country' => 'US',
                'referral_code' => 'MAYA1234',
                'email_verified_at' => now(),
            ],
        );
        foreach ([$admin, $member, $maya] as $seedUser) {
            if (! $seedUser->email_verified_at) {
                $seedUser->forceFill(['email_verified_at' => now()])->save();
            }
        }

        $method = PayoutMethod::updateOrCreate(
            ['user_id' => $member->id, 'account_last4' => '4219'],
            [
                'provider' => 'airwallex',
                'account_holder_name' => $member->name,
                'account_type' => 'bank',
                'country' => 'US',
                'currency' => 'USD',
                'routing_details' => ['routing_number' => '000000000'],
                'account_details' => ['account_number' => '000000004219'],
                'status' => 'active',
                'is_default' => true,
            ],
        );

        $taskDefinitions = [
            ['title' => 'Digital Marketing Toolkit', 'slug' => 'digital-marketing-toolkit', 'description' => 'A field-tested library of launch templates for lean marketing teams.', 'category' => 'Growth', 'price' => 47, 'incentive' => 10, 'slots' => 18, 'image' => 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85', 'checkout' => 'https://example.com/digital-marketing-toolkit', 'expires' => 2],
            ['title' => 'Product Analytics Masterclass', 'slug' => 'product-analytics-masterclass', 'description' => 'Learn the practical analytics workflows used by high-performing product teams.', 'category' => 'Learning', 'price' => 29, 'incentive' => 8, 'slots' => 32, 'image' => 'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=900&q=85', 'checkout' => 'https://example.com/product-analytics-masterclass', 'expires' => 4],
            ['title' => 'Notion Systems Workshop', 'slug' => 'notion-systems-workshop', 'description' => 'A compact workshop for building an operating system your team will actually use.', 'category' => 'Productivity', 'price' => 79, 'incentive' => 16, 'slots' => 7, 'image' => 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=85', 'checkout' => 'https://example.com/notion-systems-workshop', 'expires' => 3],
            ['title' => 'Creator Tax Essentials', 'slug' => 'creator-tax-essentials', 'description' => 'A friendly, practical guide to staying organized at tax time as a creator.', 'category' => 'Finance', 'price' => 39, 'incentive' => 9, 'slots' => 24, 'image' => 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=85', 'checkout' => 'https://example.com/creator-tax-essentials', 'expires' => 5],
            ['title' => 'Remote Work Starter Pack', 'slug' => 'remote-work-starter-pack', 'description' => 'A simple toolkit for creating a calmer and more focused home office routine.', 'category' => 'Lifestyle', 'price' => 24, 'incentive' => 6, 'slots' => 41, 'image' => 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=85', 'checkout' => 'https://example.com/remote-work-starter-pack', 'expires' => 5],
            ['title' => 'Email Copy Swipe File', 'slug' => 'email-copy-swipe-file', 'description' => 'A curated collection of email frameworks for launches, sales, and retention.', 'category' => 'Growth', 'price' => 19, 'incentive' => 5, 'slots' => 13, 'image' => 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?auto=format&fit=crop&w=900&q=85', 'checkout' => 'https://example.com/email-copy-swipe-file', 'expires' => 5],
        ];

        $tasks = [];
        foreach ($taskDefinitions as $definition) {
            $tasks[$definition['slug']] = Task::updateOrCreate(
                ['slug' => $definition['slug']],
                [
                    'title' => $definition['title'],
                    'description' => $definition['description'],
                    'category' => $definition['category'],
                    'image_path' => $definition['image'],
                    'external_checkout_url' => $definition['checkout'],
                    'reimbursement_amount' => $definition['price'],
                    'incentive_amount' => $definition['incentive'],
                    'expected_payout' => Money::add($definition['price'], $definition['incentive']),
                    'available_slots' => $definition['slots'],
                    'instructions' => [
                        'Complete the purchase using the linked partner checkout.',
                        'Return to Click & Earn and upload clear proof of purchase.',
                        'Keep the confirmation available until review is complete.',
                    ],
                    'proof_requirements' => ['Purchase from the linked checkout', 'Submit a readable receipt', 'One active task per member'],
                    'status' => 'available',
                    'starts_at' => now()->subDay(),
                    'expires_at' => now()->addDays($definition['expires']),
                    'created_by' => $admin->id,
                ],
            );
        }

        $paidReservation = TaskReservation::updateOrCreate(
            ['user_id' => $member->id, 'task_id' => $tasks['remote-work-starter-pack']->id],
            [
                'reimbursement_amount' => 24,
                'incentive_amount' => 6,
                'expected_payout' => 30,
                'status' => ReservationStatus::PAID,
                'reserved_at' => now()->subDays(6),
                'submitted_at' => now()->subDays(5),
                'approved_at' => now()->subDays(4),
                'completed_at' => now()->subDays(3),
                'expires_at' => now()->subDay(),
            ],
        );
        $reviewReservation = TaskReservation::updateOrCreate(
            ['user_id' => $member->id, 'task_id' => $tasks['digital-marketing-toolkit']->id],
            [
                'reimbursement_amount' => 47,
                'incentive_amount' => 10,
                'expected_payout' => 57,
                'status' => ReservationStatus::UNDER_REVIEW,
                'reserved_at' => now()->subDays(2),
                'submitted_at' => now()->subHours(3),
                'expires_at' => now()->addDays(2),
            ],
        );
        $reservedReservation = TaskReservation::updateOrCreate(
            ['user_id' => $member->id, 'task_id' => $tasks['product-analytics-masterclass']->id],
            [
                'reimbursement_amount' => 29,
                'incentive_amount' => 8,
                'expected_payout' => 37,
                'status' => ReservationStatus::RESERVED,
                'reserved_at' => now()->subDays(2),
                'expires_at' => now()->addDays(2),
            ],
        );

        $ledger = app(LedgerService::class);
        foreach ([$paidReservation, $reviewReservation, $reservedReservation] as $reservation) {
            $ledger->reserveTaskReward($reservation);
        }
        $ledger->updateReservationStatus($paidReservation, LedgerStatus::PAID);
        $ledger->updateReservationStatus($reviewReservation, LedgerStatus::PENDING);

        StatusHistory::updateOrCreate(
            ['subject_type' => $reviewReservation->getMorphClass(), 'subject_id' => $reviewReservation->id, 'to_status' => 'under_review'],
            ['from_status' => 'proof_submitted', 'actor_id' => $admin->id, 'reason' => 'Seeded verification queue item', 'created_at' => now()->subHours(3), 'updated_at' => now()->subHours(3)],
        );
        StatusHistory::updateOrCreate(
            ['subject_type' => $reservedReservation->getMorphClass(), 'subject_id' => $reservedReservation->id, 'to_status' => 'reserved'],
            ['from_status' => null, 'actor_id' => $member->id, 'reason' => 'Seeded reservation', 'created_at' => now()->subDays(2), 'updated_at' => now()->subDays(2)],
        );

        Storage::disk('local')->put('proofs/seed/demo-receipt.txt', 'Seed proof file for local development.');
        $proof = ProofSubmission::updateOrCreate(
            ['task_reservation_id' => $reviewReservation->id, 'version' => 1],
            [
                'user_id' => $member->id,
                'file_disk' => 'local',
                'file_path' => 'proofs/seed/demo-receipt.txt',
                'original_file_name' => 'receipt_jordan.txt',
                'mime_type' => 'text/plain',
                'file_size' => 43,
                'file_sha256' => hash('sha256', 'Seed proof file for local development.'),
                'purchase_amount' => 47,
                'purchase_date' => now()->subDays(2)->toDateString(),
                'purchase_time' => '09:42',
                'transaction_reference' => 'CE-SEED-2841',
                'user_note' => 'Seeded example proof for the admin review queue.',
                'status' => 'under_review',
                'submitted_at' => now()->subHours(3),
            ],
        );
        ReceiptVerification::updateOrCreate(
            ['proof_submission_id' => $proof->id],
            [
                'provider' => 'structured-form',
                'detected_amount' => 47,
                'detected_date' => now()->subDays(2)->toDateString(),
                'detected_time' => '09:42',
                'detected_reference' => 'CE-SEED-2841',
                'confidence_score' => 0.96,
                'amount_matches' => true,
                'date_valid' => true,
                'reference_present' => true,
                'warnings' => [],
                'raw_provider_response' => ['seeded' => true],
            ],
        );

        Payout::updateOrCreate(
            ['idempotency_key' => 'seed-paid-'.$paidReservation->id],
            [
                'user_id' => $member->id,
                'task_reservation_id' => $paidReservation->id,
                'payout_method_id' => $method->id,
                'provider' => 'fake',
                'amount' => 30,
                'currency' => 'USD',
                'status' => PayoutStatus::PAID,
                'provider_reference' => 'FAKE-PAID-4219',
                'requested_at' => now()->subDays(4),
                'processing_at' => now()->subDays(4),
                'paid_at' => now()->subDays(3),
            ],
        );

        $referral = Referral::updateOrCreate(
            ['referred_user_id' => $maya->id],
            [
                'referrer_id' => $member->id,
                'referral_code' => $member->referral_code,
                'registered_at' => now()->subDays(8),
                'qualified_at' => now()->subDays(2),
                'reward_amount' => 12,
                'reward_status' => 'pending',
            ],
        );
        $ledger->issueReferralReward($referral);

        Notification::sendNow($member, new EventNotification('Proof Submitted', 'Your Digital Marketing Toolkit submission is now Under Review.', 'processing'));
        Notification::sendNow($member, new EventNotification('Your payout is on the way', 'The $30.00 reward for Remote Work Starter Pack has been marked paid.', 'success'));
        Setting::updateOrCreate(['key' => 'verification.require_transaction_reference'], ['value' => ['enabled' => true]]);
        Setting::updateOrCreate(['key' => 'payouts.minimum_threshold'], ['value' => ['amount' => 10]]);
        Setting::updateOrCreate(['key' => 'referrals.reward_amount'], ['value' => ['amount' => 12]]);
    }
}
