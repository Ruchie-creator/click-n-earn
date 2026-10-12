<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\EventNotification;
use Tests\TestCase;

class TransactionalEmailTemplateTest extends TestCase
{
    public function test_shared_transactional_template_renders_escaped_financial_details(): void
    {
        config()->set('mail.brand_logo_url', 'https://app.example.test/brand/logo-wordmark.png');
        config()->set('app.frontend_url', 'https://app.example.test');
        $user = new User(['name' => 'Taylor <script>alert(1)</script>', 'email' => 'taylor@example.test']);
        $notification = new EventNotification('Proof approved', 'Your proof was approved.', 'success', [
            'event_key' => 'proof.approved.5',
            'task' => 'Digital Marketing Toolkit',
            'reimbursement_amount' => '47.00',
            'incentive_amount' => '10.00',
            'expected_payout' => '57.00',
            'currency' => 'USD',
        ]);

        $html = view('emails.transactional', $notification->payloadFor($user))->render();

        $this->assertStringContainsString('https://app.example.test/brand/logo-wordmark.png', $html);
        $this->assertStringContainsString('Purchase reimbursement', $html);
        $this->assertStringContainsString('USD 57.00', $html);
        $this->assertStringContainsString('View Earnings', $html);
        $this->assertStringNotContainsString('<script>alert(1)</script>', $html);
    }

    public function test_payout_email_uses_masked_destination_and_payout_history_link(): void
    {
        config()->set('app.frontend_url', 'https://app.example.test');
        $notification = new EventNotification('Payout paid', 'Your payout has been confirmed as paid.', 'success', [
            'event_key' => 'payout.paid.9',
            'amount' => '57.00',
            'currency' => 'USD',
            'reference' => 'PAY-123',
            'masked_account' => '****1234',
        ]);

        $html = view('emails.transactional', $notification->payloadFor(new User(['name' => 'Taylor'])))->render();

        $this->assertStringContainsString('****1234', $html);
        $this->assertStringContainsString('https://app.example.test/?page=payouts', $html);
    }
}
