<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class EventNotification extends Notification
{
    public function __construct(
        public readonly string $title,
        public readonly string $body,
        public readonly string $type = 'info',
        public readonly array $data = [],
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toDatabase(object $notifiable): array
    {
        return array_merge([
            'title' => $this->title,
            'body' => $this->body,
            'type' => $this->type,
        ], $this->data);
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payload = $this->payloadFor($notifiable);

        return (new MailMessage)
            ->subject($this->title)
            ->view('emails.transactional', $payload)
            ->text('emails.transactional-text', $payload);
    }

    /** @return array<string, mixed> */
    public function payloadFor(object $notifiable): array
    {
        $eventKey = (string) data_get($this->data, 'event_key', '');
        $type = (string) data_get($this->data, 'event_type', '');
        $status = match ($this->type) {
            'success' => ['#16A34A', '✓'],
            'warning' => ['#D97706', '!'],
            'error' => ['#DC2626', '×'],
            default => ['#2563EB', 'i'],
        };
        $details = $this->details($eventKey, $type);
        $financial = $this->financialDetails();
        [$ctaLabel, $ctaPath] = $this->cta($eventKey, $type);
        $ctaUrl = data_get($this->data, 'cta_url') ?: ($ctaPath ? $this->frontendUrl($ctaPath) : null);

        return [
            'name' => (string) ($notifiable->name ?: 'there'),
            'title' => $this->title,
            'emailMessage' => $this->body,
            'color' => $status[0],
            'symbol' => $status[1],
            'details' => $details,
            'financial' => $financial,
            'ctaLabel' => data_get($this->data, 'cta_label', $ctaLabel),
            'ctaUrl' => $ctaUrl,
            'securityNote' => $this->securityNote($eventKey),
            'logoUrl' => (string) config('mail.brand_logo_url'),
            'supportAddress' => config('mail.support_address'),
        ];
    }

    /** @return array<string, string> */
    private function details(string $eventKey, string $type): array
    {
        $details = [];
        if ($task = data_get($this->data, 'task')) {
            $details['Task'] = (string) $task;
        }
        if ($reference = data_get($this->data, 'reference')) {
            $details['Reference'] = (string) $reference;
        }
        if ($account = data_get($this->data, 'masked_account')) {
            $details['Destination account'] = (string) $account;
        }
        if ($member = data_get($this->data, 'member')) {
            $details['Member'] = (string) $member;
        }
        if ($submittedAt = data_get($this->data, 'submitted_at')) {
            $details['Submission time'] = (string) $submittedAt;
        }
        if ($expiresAt = data_get($this->data, 'expires_at')) {
            $details['Reservation expiry'] = (string) $expiresAt;
        }
        if ($completedAt = data_get($this->data, 'completed_at')) {
            $details['Completion date'] = (string) $completedAt;
        }
        if ($note = data_get($this->data, 'reviewer_note')) {
            $details['Reviewer note'] = (string) $note;
        }
        if ($reason = data_get($this->data, 'reason')) {
            $details['Details'] = (string) $reason;
        }
        if (str_starts_with($eventKey, 'proof.submitted')) {
            $details['Status'] = 'Under Review';
        }
        if (str_starts_with($eventKey, 'payout.processing')) {
            $details['Status'] = 'Processing';
        }
        if (str_starts_with($eventKey, 'payout.paid')) {
            $details['Status'] = 'Paid';
        }

        return $details;
    }

    /** @return array<string, string> */
    private function financialDetails(): array
    {
        $currency = (string) data_get($this->data, 'currency', config('payout.currency', 'USD'));
        $values = [
            'Purchase reimbursement' => data_get($this->data, 'reimbursement_amount'),
            'Incentive' => data_get($this->data, 'incentive_amount'),
            'Expected payout' => data_get($this->data, 'expected_payout'),
            'Amount' => data_get($this->data, 'amount'),
            'Reward amount' => data_get($this->data, 'reward_amount'),
        ];

        return collect($values)->filter(fn ($value): bool => $value !== null && $value !== '')
            ->map(fn ($value): string => $this->formatCurrency((string) $value, $currency))->all();
    }

    /** @return array{string, string} */
    private function cta(string $eventKey, string $type): array
    {
        $adminNotification = (bool) data_get($this->data, 'admin_notification');

        return match (true) {
            str_starts_with($eventKey, 'email.verified') => ['Browse Available Tasks', '/?page=tasks'],
            str_starts_with($eventKey, 'welcome') => ['Browse Available Tasks', '/?page=tasks'],
            str_starts_with($eventKey, 'reservation.created') && $adminNotification => ['Review Reservations', '/?page=admin-dashboard'],
            str_starts_with($eventKey, 'reservation.created') => ['View Task', '/?page=task-detail&task='.data_get($this->data, 'task_id')],
            str_starts_with($eventKey, 'reservation.expiring') => ['Complete Task', '/?page=my-tasks'],
            str_starts_with($eventKey, 'reservation.') => ['Browse Available Tasks', '/?page=tasks'],
            str_starts_with($eventKey, 'proof.') && $adminNotification => ['Review Submission', '/?page=admin-verification&submission='.data_get($this->data, 'proof_submission_id')],
            str_starts_with($eventKey, 'proof.changes_requested') => ['Update Proof', '/?page=proof&reservation='.data_get($this->data, 'reservation_id')],
            str_starts_with($eventKey, 'proof.approved') => ['View Earnings', '/?page=earnings'],
            str_starts_with($eventKey, 'proof.submitted') => ['View My Task', '/?page=my-tasks'],
            str_starts_with($eventKey, 'proof.') => ['View Task', '/?page=my-tasks'],
            str_starts_with($eventKey, 'payout.paid') => ['View Payout History', '/?page=payouts'],
            str_starts_with($eventKey, 'payout.failed') && data_get($this->data, 'admin_notification') => ['Review Payout', '/?page=admin-payouts'],
            str_starts_with($eventKey, 'payout.') => ['View Payout', '/?page=payouts'],
            str_starts_with($eventKey, 'payout_verification.') && $adminNotification => ['Review Bank Accounts', '/?page=admin-payout-verification'],
            str_starts_with($eventKey, 'payout_verification.') => ['View Bank Account Settings', '/?page=payouts'],
            str_starts_with($eventKey, 'referral.pending_approval') => ['Review Referral Rewards', '/?page=admin-referrals'],
            str_starts_with($eventKey, 'referral.') => ['View Referrals', '/?page=referrals'],
            default => ['Open Click & Earn', '/?page=notifications'],
        };
    }

    private function frontendUrl(string $path): string
    {
        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return $base.$path;
    }

    private function securityNote(string $eventKey): ?string
    {
        return Str::contains($eventKey, ['password.', 'reset'])
            ? 'If you did not request this, secure your account immediately.'
            : null;
    }

    private function formatCurrency(string $value, string $currency): string
    {
        return strtoupper($currency).' '.number_format((float) $value, 2);
    }
}
