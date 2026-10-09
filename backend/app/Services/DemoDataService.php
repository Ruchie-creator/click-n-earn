<?php

namespace App\Services;

use App\Enums\AccountStatus;
use App\Enums\ReservationStatus;
use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\DemoBatch;
use App\Models\LedgerEntry;
use App\Models\NotificationOutbox;
use App\Models\Payout;
use App\Models\PayoutMethod;
use App\Models\ProofSubmission;
use App\Models\ReceiptVerification;
use App\Models\Referral;
use App\Models\StatusHistory;
use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use App\Notifications\EventNotification;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class DemoDataService
{
    private const TASKS = [
        ['ai-writing-tool', 'AI Writing Tool Purchase', 'Content tools', '29.00', '8.00', 'A fictional writing assistant subscription preview.', 'bought a monthly writing plan'],
        ['digital-marketing-toolkit', 'Digital Marketing Toolkit', 'Marketing', '39.00', '10.00', 'A fictional campaign-planning toolkit preview.', 'bought a sample campaign toolkit'],
        ['productivity-template-bundle', 'Productivity Template Bundle', 'Productivity', '18.00', '6.00', 'A fictional planning template bundle preview.', 'downloaded a sample planner bundle'],
        ['social-design-pack', 'Social Media Design Pack', 'Design', '34.00', '9.00', 'A fictional design resource pack preview.', 'bought a sample design resource pack'],
        ['seo-research-toolkit', 'SEO Research Toolkit', 'Research', '44.00', '12.00', 'A fictional keyword research toolkit preview.', 'bought a sample research toolkit'],
        ['business-planning-template', 'Business Planning Template', 'Business', '22.00', '7.00', 'A fictional business-planning template preview.', 'bought a sample business template'],
        ['creator-resource-pack', 'Content Creator Resource Pack', 'Creator tools', '25.00', '8.00', 'A fictional creator resource pack preview.', 'bought a sample creator resource pack'],
        ['analytics-dashboard-toolkit', 'Analytics Dashboard Toolkit', 'Analytics', '49.00', '14.00', 'A fictional analytics dashboard toolkit preview.', 'bought a sample analytics toolkit'],
    ];

    private const WORKFLOWS = [
        ['reserved', 1, 'member'],
        ['proof_submitted', 2, 'member'],
        ['under_review', 3, 'member'],
        ['approved', 4, 'member'],
        ['processing', 5, 'member_two'],
        ['paid', 6, 'member'],
        ['changes_requested', 7, 'member_two'],
    ];

    private const COUNTS = [
        'users' => User::class,
        'tasks' => Task::class,
        'reservations' => TaskReservation::class,
        'proofs' => ProofSubmission::class,
        'payouts' => Payout::class,
        'ledger_entries' => LedgerEntry::class,
        'notifications' => 'notifications',
    ];

    public function __construct(
        private readonly TaskReservationService $reservations,
        private readonly StatusTransitionService $transitions,
        private readonly VerificationService $verification,
        private readonly ReceiptVerificationService $receiptVerification,
        private readonly PayoutService $payouts,
        private readonly ReferralService $referrals,
        private readonly LedgerService $ledger,
        private readonly AuditLogService $audit,
        private readonly EventNotificationService $notifications,
    ) {}

    public function controlsAvailable(): bool
    {
        return ! app()->environment('production')
            && config('demo.enabled') === true
            && config('demo.client_preview') === true
            && config('payout.driver') === 'fake';
    }

    /** @return array{enabled: bool, client_preview: bool, installed: bool, batch_label: string, counts: array<string, int>} */
    public function status(): array
    {
        $batch = DemoBatch::query()->where('slug', config('demo.batch_slug'))->first();
        $counts = [];
        foreach (self::COUNTS as $key => $source) {
            $counts[$key] = $batch ? $this->countForBatch($source, (string) $batch->id) : 0;
        }

        return [
            'enabled' => (bool) config('demo.enabled'),
            'client_preview' => (bool) config('demo.client_preview'),
            'installed' => array_sum($counts) > 0,
            'batch_label' => (string) config('demo.batch_label'),
            'counts' => $counts,
        ];
    }

    public function seed(): array
    {
        $this->assertMutationAllowed();
        $credentials = $this->validatedCredentials();
        $createdFiles = [];

        try {
            DB::transaction(function () use ($credentials, &$createdFiles): void {
                $batch = DemoBatch::query()->firstOrCreate(
                    ['slug' => (string) config('demo.batch_slug')],
                    [
                        'id' => (string) Str::uuid(),
                        'label' => (string) config('demo.batch_label'),
                        'metadata' => ['purpose' => 'client_preview', 'synthetic' => true],
                    ],
                );
                if ($batch->label !== config('demo.batch_label')) {
                    $batch->forceFill(['label' => (string) config('demo.batch_label')])->save();
                }

                $member = $this->ensureUser($batch, 'member', 'Demo Member', 'member', $credentials['member']);
                $memberTwo = $this->ensureUser($batch, 'member-two', 'Demo Member 2', 'member_two', $credentials['member_two']);
                $admin = $this->ensureUser($batch, 'administrator', 'Demo Administrator', 'admin', $credentials['admin']);

                $tasks = [];
                foreach (self::TASKS as $index => $definition) {
                    $tasks[$index] = $this->ensureTask($batch, $admin, $definition);
                }

                $this->ensurePayoutMethod($batch, $member, 'payout-method-member');
                $this->ensurePayoutMethod($batch, $memberTwo, 'payout-method-member-two');
                $this->ensureReferral($batch, $member, $memberTwo);

                foreach (self::WORKFLOWS as [$state, $taskIndex, $memberKey]) {
                    $user = $memberKey === 'member_two' ? $memberTwo : $member;
                    $reservationKey = 'reservation-'.$state;
                    $reservation = TaskReservation::query()
                        ->where('demo_batch_id', $batch->id)
                        ->where('demo_key', $reservationKey)
                        ->first();
                    if (! $reservation) {
                        $reservation = $this->reservations->reserve($user, $tasks[$taskIndex], $reservationKey);
                    }

                    if ($state !== 'reserved') {
                        $proof = $this->ensureProof($batch, $reservation, $state, $createdFiles);
                        $this->ensureWorkflowState($reservation, $proof, $state, $admin);
                        $this->receiptVerification->verify($proof->fresh());
                    }
                }
            });
        } catch (\Throwable $exception) {
            foreach ($createdFiles as [$disk, $path]) {
                Storage::disk($disk)->delete($path);
            }

            throw $exception;
        }

        return $this->status();
    }

    public function clear(): array
    {
        $this->assertMutationAllowed();

        return $this->clearCurrentBatch();
    }

    public function refresh(): array
    {
        $this->assertMutationAllowed();
        $this->validatedCredentials();
        $this->clearCurrentBatch();

        return $this->seed();
    }

    private function assertMutationAllowed(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('Demo data operations are disabled in production.');
        }
        $connection = (string) config('database.default');
        $connectionConfig = config('database.connections.'.$connection, []);
        $databaseName = strtolower(trim((string) data_get($connectionConfig, 'database')));
        $databaseUrl = data_get($connectionConfig, 'url');
        $urlDatabaseName = is_string($databaseUrl) ? strtolower(trim((string) parse_url($databaseUrl, PHP_URL_PATH), '/')) : '';
        if (array_intersect([$databaseName, $urlDatabaseName], ['click_and_earn_prod', 'click_and_earn_production']) !== []) {
            throw new RuntimeException('Demo data operations cannot run against a production database target.');
        }
        if (! config('demo.enabled') || ! config('demo.client_preview')) {
            throw new RuntimeException('Set DEMO_DATA_ENABLED=true and CLIENT_PREVIEW=true before using demo data operations.');
        }
        if (config('payout.driver') !== 'fake') {
            throw new RuntimeException('Demo data operations require PAYOUT_DRIVER=fake; no payout provider will be called.');
        }
    }

    /** @return array{member: string, member_two: string, admin: string} */
    private function validatedCredentials(): array
    {
        $credentials = [
            'member' => (string) config('demo.accounts.member.password'),
            'member_two' => (string) config('demo.accounts.member_two.password'),
            'admin' => (string) config('demo.accounts.admin.password'),
        ];
        foreach ($credentials as $name => $password) {
            if (strlen($password) < 12) {
                throw new RuntimeException('Configure DEMO_MEMBER_PASSWORD, DEMO_MEMBER_TWO_PASSWORD, and DEMO_ADMIN_PASSWORD with unique values of at least 12 characters.');
            }
        }
        if (count(array_unique($credentials)) !== count($credentials)) {
            throw new RuntimeException('Each demo account must have a different password.');
        }

        foreach (['member', 'member_two', 'admin'] as $account) {
            $email = (string) config('demo.accounts.'.$account.'.email');
            $domain = strtolower(substr(strrchr($email, '@') ?: '', 1));
            if (! filter_var($email, FILTER_VALIDATE_EMAIL)
                || ! (str_ends_with($domain, '.example') || str_ends_with($domain, '.invalid') || str_ends_with($domain, '.test'))) {
                throw new RuntimeException('Demo account email addresses must use a reserved .example, .invalid, or .test domain.');
            }
        }

        return $credentials;
    }

    private function ensureUser(DemoBatch $batch, string $demoKey, string $name, string $account, string $password): User
    {
        $email = (string) config('demo.accounts.'.$account.'.email');
        $role = $account === 'admin' ? UserRole::ADMIN : UserRole::MEMBER;
        $referralCode = match ($account) {
            'member' => 'DEMOMEMBER01',
            'member_two' => 'DEMOMEMBER02',
            default => 'DEMOADMIN001',
        };
        $user = User::query()
            ->where('demo_batch_id', $batch->id)
            ->where('demo_key', $demoKey)
            ->first();

        if ($user) {
            if (strcasecmp((string) $user->email, $email) !== 0) {
                throw new RuntimeException('A demo account email changed. Clear the preview batch before changing its account configuration.');
            }
            $user->forceFill([
                'name' => $name,
                'role' => $role,
                'account_status' => AccountStatus::ACTIVE,
                'email_verified_at' => $user->email_verified_at ?: now(),
            ])->save();

            return $user->fresh();
        }

        if (User::query()->where('email', $email)->exists()) {
            throw new RuntimeException('A non-demo account already uses a configured demo email; no account was modified.');
        }
        if (User::query()->where('referral_code', $referralCode)->exists()) {
            throw new RuntimeException('A non-demo account already uses a reserved demo referral code; no account was modified.');
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'role' => $role,
            'account_status' => AccountStatus::ACTIVE,
            'referral_code' => $referralCode,
            'email_verified_at' => now(),
        ]);
        $user->forceFill(['demo_batch_id' => $batch->id, 'demo_key' => $demoKey])->save();

        return $user;
    }

    /** @param array{0: string, 1: string, 2: string, 3: string, 4: string, 5: string, 6: string} $definition */
    private function ensureTask(DemoBatch $batch, User $admin, array $definition): Task
    {
        [$slug, $title, $category, $reimbursement, $incentive, $description, $purchaseLabel] = $definition;
        $demoKey = 'task-'.$slug;
        $task = Task::query()
            ->where('demo_batch_id', $batch->id)
            ->where('demo_key', $demoKey)
            ->first();
        if ($task) {
            return $task;
        }
        if (Task::query()->where('slug', $slug)->exists()) {
            throw new RuntimeException('A non-demo task already uses a reserved demo task slug; no task was modified.');
        }

        $task = Task::create([
            'title' => $title,
            'slug' => $slug,
            'description' => $description.' This scenario is fictional; the checkout link is a reserved, non-purchasable placeholder.',
            'category' => $category,
            'image_path' => null,
            'external_checkout_url' => 'https://preview.clickandearn.invalid/checkout/'.$slug,
            'reimbursement_amount' => $reimbursement,
            'incentive_amount' => $incentive,
            'expected_payout' => Money::add($reimbursement, $incentive),
            'available_slots' => 30,
            'reserved_slots' => 0,
            'completed_slots' => 0,
            'instructions' => [
                'Open the fictional preview checkout link; no purchase is possible.',
                'Review the sample product details and return to Click & Earn.',
                'Upload a synthetic proof file to exercise the review workflow.',
                'Do not enter real payment or personal information.',
            ],
            'proof_requirements' => [
                'Synthetic preview receipt only',
                'Visible sample transaction reference',
                'No real purchase required',
            ],
            'status' => 'available',
            'starts_at' => now()->subDay(),
            'expires_at' => now()->addDays(45),
            'created_by' => $admin->id,
        ]);
        $task->forceFill(['demo_batch_id' => $batch->id, 'demo_key' => $demoKey])->save();
        $this->audit->record('demo.task.seeded', $task, actorId: $admin->id, after: $task->toArray());

        return $task;
    }

    private function ensurePayoutMethod(DemoBatch $batch, User $user, string $demoKey): PayoutMethod
    {
        $method = PayoutMethod::query()
            ->where('demo_batch_id', $batch->id)
            ->where('demo_key', $demoKey)
            ->first();
        if ($method) {
            return $method;
        }

        $method = PayoutMethod::create([
            'user_id' => $user->id,
            'provider' => 'fake',
            'account_holder_name' => $user->name,
            'account_type' => 'demo_wallet',
            'country' => 'US',
            'currency' => 'USD',
            'routing_details' => null,
            'account_details' => null,
            'account_last4' => '0000',
            'provider_beneficiary_id' => null,
            'status' => 'active',
            'is_default' => true,
        ]);
        $method->forceFill(['demo_batch_id' => $batch->id, 'demo_key' => $demoKey])->save();

        return $method;
    }

    private function ensureReferral(DemoBatch $batch, User $member, User $memberTwo): Referral
    {
        $demoKey = 'referral-member-two';
        $referral = Referral::query()
            ->where('demo_batch_id', $batch->id)
            ->where('demo_key', $demoKey)
            ->first();
        if ($referral) {
            return $referral;
        }

        $existing = Referral::query()->where('referred_user_id', $memberTwo->id)->first();
        if ($existing && $existing->getAttribute('demo_batch_id') !== $batch->id) {
            throw new RuntimeException('The second demo member already has an unrelated referral; no referral data was changed.');
        }

        if ($memberTwo->referred_by && (int) $memberTwo->referred_by !== (int) $member->id) {
            throw new RuntimeException('The second demo member already has a different referrer; no user data was changed.');
        }
        $memberTwo->forceFill(['referred_by' => $member->id])->save();
        $referral = $this->referrals->registerReferral($memberTwo, (string) $member->referral_code);
        if (! $referral) {
            throw new RuntimeException('The preview referral could not be created.');
        }
        $referral->forceFill(['demo_batch_id' => $batch->id, 'demo_key' => $demoKey])->save();

        return $referral;
    }

    /** @param array<int, array{0: string, 1: string}> $createdFiles */
    private function ensureProof(DemoBatch $batch, TaskReservation $reservation, string $state, array &$createdFiles): ProofSubmission
    {
        $demoKey = sprintf('proof-%s', $state);
        $existing = ProofSubmission::query()
            ->where('demo_batch_id', $batch->id)
            ->where('demo_key', $demoKey)
            ->first();
        if ($existing) {
            return $existing;
        }

        $disk = (string) config('filesystems.proof_disk');
        $diskConfig = config('filesystems.disks.'.$disk, []);
        if ($disk === '' || $disk === 'public' || data_get($diskConfig, 'visibility') === 'public') {
            throw new RuntimeException('Demo proofs require the application private proof-storage disk.');
        }

        $purchaseDate = now()->subDays(match ($state) {
            'paid' => 12,
            'processing' => 4,
            default => 2,
        })->toDateString();
        $reference = 'DEMO-PROOF-'.strtoupper(str_replace('_', '-', $state));
        $bytes = $this->demoPdf($reservation, $state, $purchaseDate, $reference);
        $path = sprintf('proofs/%d/%d/demo-%s.pdf', $reservation->user_id, $reservation->id, $state);
        if (! Storage::disk($disk)->exists($path)) {
            if (! Storage::disk($disk)->put($path, $bytes)) {
                throw new RuntimeException('A synthetic demo proof could not be written to private storage.');
            }
            $createdFiles[] = [$disk, $path];
        }

        $proof = ProofSubmission::create([
            'task_reservation_id' => $reservation->id,
            'user_id' => $reservation->user_id,
            'previous_submission_id' => null,
            'version' => 1,
            'file_disk' => $disk,
            'file_path' => $path,
            'original_file_name' => 'DEMO-preview-proof-'.$state.'.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => strlen($bytes),
            'file_sha256' => hash('sha256', $bytes),
            'transaction_reference_key' => hash('sha256', mb_strtolower($reference)),
            'idempotency_key' => hash('sha256', 'demo-proof-'.$batch->id.'-'.$state),
            'request_fingerprint' => hash('sha256', $batch->id.'-'.$reservation->id.'-'.$state),
            'is_current' => true,
            'purchase_amount' => $reservation->reimbursement_amount,
            'purchase_date' => $purchaseDate,
            'purchase_time' => '10:15:00',
            'transaction_reference' => $reference,
            'user_note' => 'Synthetic client preview proof. No purchase was made and no payment details are present.',
            'status' => $this->reservationStatus($reservation),
            'submitted_at' => $reservation->submitted_at ?: now()->subDays(1),
        ]);
        $proof->forceFill(['demo_batch_id' => $batch->id, 'demo_key' => $demoKey])->save();
        $this->audit->record('demo.proof.seeded', $proof, actorId: $reservation->user_id, after: $proof->toArray());

        return $proof;
    }

    private function ensureWorkflowState(TaskReservation $reservation, ProofSubmission $proof, string $target, User $admin): void
    {
        $current = $this->reservationStatus($reservation);
        if ($current === 'reserved') {
            $this->transitions->transition(
                $reservation,
                ReservationStatus::PROOF_SUBMITTED->value,
                $reservation->user_id,
                'Synthetic proof submitted for client preview.',
                ['proof_submission_id' => $proof->id, 'demo' => true],
            );
            $proof->forceFill(['status' => ReservationStatus::PROOF_SUBMITTED->value])->save();
            $this->audit->record('demo.proof.submitted', $proof, actorId: $reservation->user_id, after: $proof->toArray());
            $this->notifications->notifyOnce($reservation->user, 'demo.proof.submitted.'.$proof->id, new EventNotification(
                'Proof submitted',
                sprintf('Your synthetic preview proof for %s is ready for review.', $reservation->task()->value('title')),
                'processing',
                ['proof_submission_id' => $proof->id, 'reservation_id' => $reservation->id],
            ), $reservation->getAttribute('demo_batch_id'));
            $current = 'proof_submitted';
        }

        if ($target === 'proof_submitted') {
            return;
        }

        if ($current === 'proof_submitted') {
            $this->verification->moveToReview($proof, (int) $admin->id);
            $current = 'under_review';
        }
        if ($target === 'under_review') {
            return;
        }

        if ($current === 'under_review') {
            if ($target === 'changes_requested') {
                $this->verification->requestChanges($proof, (int) $admin->id, 'Please review the sample transaction reference; this is a synthetic preview scenario.');

                return;
            }
            $this->verification->approve($proof, (int) $admin->id);
            $current = 'approved';
        }

        if ($target === 'approved' || $current !== 'approved' || ! in_array($target, ['processing', 'paid'], true)) {
            return;
        }

        $payout = $reservation->fresh()->payout()->first();
        if (! $payout) {
            throw new RuntimeException('An approved demo reservation is missing its payout record.');
        }
        $originalOutcome = config('payout.fake_outcome');
        try {
            config(['payout.fake_outcome' => $target === 'paid' ? 'paid' : 'processing']);
            $this->payouts->process($payout);
        } finally {
            config(['payout.fake_outcome' => $originalOutcome]);
        }
    }

    private function reservationStatus(TaskReservation $reservation): string
    {
        $status = $reservation->status;

        return $status instanceof \BackedEnum ? $status->value : (string) $status;
    }

    private function demoPdf(TaskReservation $reservation, string $state, string $purchaseDate, string $reference): string
    {
        $taskTitle = (string) $reservation->task()->value('title');
        $lines = [
            'CLICK AND EARN - CLIENT PREVIEW',
            'SYNTHETIC DEMO PROOF - NOT A REAL RECEIPT',
            'No purchase was made. Do not submit payment or personal details.',
            'Scenario: '.$state,
            'Task: '.$taskTitle,
            'Sample amount: USD '.number_format((float) $reservation->reimbursement_amount, 2, '.', ''),
            'Sample date: '.$purchaseDate,
            'Sample reference: '.$reference,
        ];
        $stream = "BT\n/F1 17 Tf\n48 750 Td\n";
        foreach ($lines as $index => $line) {
            if ($index > 0) {
                $stream .= "0 -30 Td\n/F1 ".($index < 2 ? '12' : '10')." Tf\n";
            }
            $escaped = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $line);
            $stream .= '('.$escaped.") Tj\n";
        }
        $stream .= "ET\n";

        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
            '<< /Length '.strlen($stream).">>\nstream\n".$stream.'endstream',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];
        $pdf = "%PDF-1.4\n%DEMO\n";
        $offsets = [0];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n".$object."\nendobj\n";
        }
        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        for ($index = 1; $index <= count($objects); $index++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$index]);
        }
        $pdf .= 'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n".$xrefOffset."\n%%EOF\n";

        return $pdf;
    }

    private function clearCurrentBatch(): array
    {
        $result = DB::transaction(function (): array {
            $batch = DemoBatch::query()->where('slug', config('demo.batch_slug'))->lockForUpdate()->first();
            if (! $batch) {
                return ['found' => false, 'counts' => [], 'files' => [], 'status' => $this->status()];
            }

            $batchId = (string) $batch->id;
            $userIds = User::query()->where('demo_batch_id', $batchId)->pluck('id')->all();
            $taskIds = Task::query()->where('demo_batch_id', $batchId)->pluck('id')->all();
            $reservationIds = TaskReservation::query()->where('demo_batch_id', $batchId)->pluck('id')->all();
            $proofIds = ProofSubmission::query()->where('demo_batch_id', $batchId)->pluck('id')->all();
            $referralIds = Referral::query()->where('demo_batch_id', $batchId)->pluck('id')->all();
            $payoutIds = Payout::query()->where('demo_batch_id', $batchId)->pluck('id')->all();
            $methodIds = PayoutMethod::query()->where('demo_batch_id', $batchId)->pluck('id')->all();
            $affectedTaskIds = TaskReservation::query()
                ->where('demo_batch_id', $batchId)
                ->pluck('task_id')
                ->unique()
                ->all();

            $this->assertNoUnmarkedRelatedRecords($batchId, $userIds, $taskIds, $reservationIds, $proofIds, $referralIds, $payoutIds, $methodIds);

            $counts = [];
            foreach (self::COUNTS as $key => $source) {
                $counts[$key] = $this->countForBatch($source, $batchId);
            }
            $files = ProofSubmission::query()
                ->where('demo_batch_id', $batchId)
                ->get(['user_id', 'task_reservation_id', 'file_disk', 'file_path'])
                ->map(fn (ProofSubmission $proof): array => [
                    'user_id' => (int) $proof->user_id,
                    'reservation_id' => (int) $proof->task_reservation_id,
                    'disk' => (string) $proof->file_disk,
                    'path' => (string) $proof->file_path,
                ])
                ->all();

            ReceiptVerification::query()->where('demo_batch_id', $batchId)->delete();
            ProofSubmission::query()->where('demo_batch_id', $batchId)->delete();
            NotificationOutbox::query()->where('demo_batch_id', $batchId)->delete();
            DB::table('notifications')->where('demo_batch_id', $batchId)->delete();
            StatusHistory::query()->where('demo_batch_id', $batchId)->delete();
            AuditLog::query()->where('demo_batch_id', $batchId)->delete();
            LedgerEntry::query()->where('demo_batch_id', $batchId)->delete();
            Payout::query()->where('demo_batch_id', $batchId)->delete();
            Referral::query()->where('demo_batch_id', $batchId)->delete();
            PayoutMethod::query()->where('demo_batch_id', $batchId)->delete();
            TaskReservation::query()->where('demo_batch_id', $batchId)->delete();

            $this->recalculateNonDemoTaskCapacity($batchId, $affectedTaskIds);
            Task::query()->where('demo_batch_id', $batchId)->delete();

            if ($userIds !== [] && Schema::hasTable('personal_access_tokens')) {
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', (new User)->getMorphClass())
                    ->whereIn('tokenable_id', $userIds)
                    ->delete();
            }
            if ($userIds !== [] && Schema::hasTable('sessions')) {
                DB::table('sessions')->whereIn('user_id', $userIds)->delete();
            }
            if ($userIds !== [] && Schema::hasTable('password_reset_tokens')) {
                $emails = User::query()->whereIn('id', $userIds)->pluck('email')->all();
                DB::table('password_reset_tokens')->whereIn('email', $emails)->delete();
            }

            User::query()->where('demo_batch_id', $batchId)->delete();
            $batch->delete();

            return ['found' => true, 'counts' => $counts, 'files' => $files, 'status' => null];
        });

        if (! $result['found']) {
            return ['found' => false, 'counts' => $result['counts'], 'files_deleted' => 0, 'files_skipped' => 0];
        }

        $deletedFiles = 0;
        $skippedFiles = 0;
        foreach ($result['files'] as $file) {
            $disk = $file['disk'];
            $expectedPrefix = sprintf('proofs/%d/%d/', $file['user_id'], $file['reservation_id']);
            if ($disk !== config('filesystems.proof_disk')
                || $disk === 'public'
                || ! str_starts_with($file['path'], $expectedPrefix)
                || str_contains($file['path'], '..')) {
                $skippedFiles++;

                continue;
            }
            try {
                $deleted = Storage::disk($disk)->delete($file['path']);
            } catch (\Throwable) {
                $deleted = false;
            }
            if ($deleted) {
                $deletedFiles++;
            } else {
                $skippedFiles++;
            }
        }

        return [
            'found' => true,
            'counts' => $result['counts'],
            'files_deleted' => $deletedFiles,
            'files_skipped' => $skippedFiles,
        ];
    }

    private function assertNoUnmarkedRelatedRecords(
        string $batchId,
        array $userIds,
        array $taskIds,
        array $reservationIds,
        array $proofIds,
        array $referralIds,
        array $payoutIds,
        array $methodIds,
    ): void {
        $blockers = [];
        $unmarked = fn ($query) => $query->where(fn ($scope) => $scope->whereNull('demo_batch_id')->orWhere('demo_batch_id', '<>', $batchId));

        if ($this->hasUnmarked(Task::class, ['created_by' => $userIds], $unmarked)) {
            $blockers[] = 'tasks created by a demo administrator';
        }
        if ($this->hasUnmarked(TaskReservation::class, ['user_id' => $userIds, 'task_id' => $taskIds], $unmarked)) {
            $blockers[] = 'reservations linked to a demo user or task';
        }
        if ($this->hasUnmarked(ProofSubmission::class, ['user_id' => $userIds, 'task_reservation_id' => $reservationIds], $unmarked)) {
            $blockers[] = 'proofs linked to a demo user or reservation';
        }
        if ($this->hasUnmarked(ReceiptVerification::class, ['proof_submission_id' => $proofIds], $unmarked)) {
            $blockers[] = 'receipt-verification records linked to a demo proof';
        }
        if ($this->hasUnmarked(Referral::class, ['referrer_id' => $userIds, 'referred_user_id' => $userIds], $unmarked)) {
            $blockers[] = 'referrals linked to a demo user';
        }
        if ($this->hasUnmarked(PayoutMethod::class, ['user_id' => $userIds], $unmarked)) {
            $blockers[] = 'payout methods linked to a demo user';
        }
        if ($this->hasUnmarked(Payout::class, [
            'user_id' => $userIds,
            'task_reservation_id' => $reservationIds,
            'referral_id' => $referralIds,
            'payout_method_id' => $methodIds,
        ], $unmarked)) {
            $blockers[] = 'payouts linked to a demo user or workflow';
        }
        if ($this->hasUnmarked(LedgerEntry::class, [
            'user_id' => $userIds,
            'task_reservation_id' => $reservationIds,
            'referral_id' => $referralIds,
            'payout_id' => $payoutIds,
        ], $unmarked)) {
            $blockers[] = 'ledger entries linked to a demo user or workflow';
        }
        if ($this->hasUnmarked(NotificationOutbox::class, ['user_id' => $userIds], $unmarked)) {
            $blockers[] = 'notification outbox records linked to a demo user';
        }

        if ($userIds !== []) {
            $morphClass = (new User)->getMorphClass();
            $query = DB::table('notifications')
                ->where('notifiable_type', $morphClass)
                ->whereIn('notifiable_id', $userIds)
                ->where(fn ($scope) => $scope->whereNull('demo_batch_id')->orWhere('demo_batch_id', '<>', $batchId));
            if ($query->exists()) {
                $blockers[] = 'in-app notifications linked to a demo user';
            }
        }

        $subjects = [
            User::class => $userIds,
            Task::class => $taskIds,
            TaskReservation::class => $reservationIds,
            ProofSubmission::class => $proofIds,
            Referral::class => $referralIds,
            Payout::class => $payoutIds,
        ];
        foreach ([AuditLog::class, StatusHistory::class] as $activityModel) {
            foreach ($subjects as $subjectType => $subjectIds) {
                if ($subjectIds === []) {
                    continue;
                }
                $query = $activityModel::query()
                    ->where('subject_type', $subjectType)
                    ->whereIn('subject_id', $subjectIds);
                $unmarked($query);
                if ($query->exists()) {
                    $blockers[] = 'unmarked '.($activityModel === AuditLog::class ? 'audit' : 'status-history').' records linked to demo data';
                    break 2;
                }
            }
        }

        $batchReferrals = Referral::query()->where('demo_batch_id', $batchId);
        if ($userIds !== [] && $batchReferrals->where(function ($query) use ($userIds): void {
            $query->whereNotIn('referrer_id', $userIds)->orWhereNotIn('referred_user_id', $userIds);
        })->exists()) {
            $blockers[] = 'a demo referral linked to a non-demo account';
        }

        if ($blockers !== []) {
            throw new RuntimeException('Demo cleanup stopped before deleting anything because it found '.implode('; ', array_unique($blockers)).'. Resolve the linked records, then retry.');
        }
    }

    /** @param array<string, array<int, int|string>> $columns */
    private function hasUnmarked(string $modelClass, array $columns, callable $unmarked): bool
    {
        $columns = array_filter($columns, static fn (array $ids): bool => $ids !== []);
        if ($columns === []) {
            return false;
        }
        $query = $modelClass::query()->where(function ($scope) use ($columns): void {
            foreach ($columns as $column => $ids) {
                $scope->orWhereIn($column, $ids);
            }
        });
        $unmarked($query);

        return $query->exists();
    }

    private function recalculateNonDemoTaskCapacity(string $batchId, array $taskIds): void
    {
        $active = array_map(static fn (ReservationStatus $status): string => $status->value, array_filter(
            ReservationStatus::cases(),
            static fn (ReservationStatus $status): bool => $status->isActive(),
        ));
        foreach ($taskIds as $taskId) {
            $task = Task::query()->whereKey($taskId)->where(function ($query) use ($batchId): void {
                $query->whereNull('demo_batch_id')->orWhere('demo_batch_id', '<>', $batchId);
            })->first();
            if (! $task) {
                continue;
            }
            $task->forceFill([
                'reserved_slots' => TaskReservation::query()->where('task_id', $taskId)->whereIn('status', $active)->count(),
                'completed_slots' => TaskReservation::query()->where('task_id', $taskId)->whereIn('status', ['paid', 'reversed'])->count(),
            ])->save();
        }
    }

    private function countForBatch(string $source, string $batchId): int
    {
        if ($source === 'notifications') {
            return (int) DB::table('notifications')->where('demo_batch_id', $batchId)->count();
        }

        /** @var class-string<Model> $source */
        return (int) $source::query()->where('demo_batch_id', $batchId)->count();
    }
}
