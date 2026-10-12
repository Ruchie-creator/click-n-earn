<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\NotificationOutbox;
use App\Models\Setting;
use App\Notifications\EventNotification;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class SettingController extends ApiController
{
    public function index(): JsonResponse
    {
        return $this->ok(Setting::query()->orderBy('key')->get()->map(fn (Setting $setting): array => [
            'key' => $setting->key,
            'value' => $setting->value,
            'updated_at' => $setting->updated_at?->toISOString(),
        ]));
    }

    public function update(Request $request, string $key, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate(['value' => ['required', 'array']]);
        $setting = Setting::firstOrNew(['key' => $key]);
        $before = $setting->exists ? $setting->toArray() : null;
        $setting->value = $data['value'];
        $setting->save();
        $audit->record('setting.updated', $setting, $request, before: $before, after: $setting->toArray(), actorId: $request->user()->id);

        return $this->ok([
            'key' => $setting->key,
            'value' => $setting->value,
            'updated_at' => $setting->updated_at?->toISOString(),
        ]);
    }

    public function emailStatus(): JsonResponse
    {
        $configured = filled(config('mail.from.address'))
            && filled(config('mail.mailers.smtp.host'))
            && filled(config('mail.mailers.smtp.username'))
            && filled(config('mail.mailers.smtp.password'));

        return $this->ok([
            'configured' => $configured,
            'sender_email' => config('mail.from.address'),
            'sender_name' => config('mail.from.name'),
            'queue_connection' => config('queue.default'),
            'recent_failures' => NotificationOutbox::query()->where('email_status', 'failed')->latest()->limit(10)->get(['id', 'event_key', 'email_attempts', 'email_last_error', 'updated_at']),
            'events' => ['Welcome', 'Password reset', 'Password changed', 'Reward reserved', 'Reservation expiring', 'Reservation expired', 'Proof submitted', 'Changes requested', 'Proof approved', 'Proof rejected', 'Payout processing', 'Payout paid', 'Payout failed', 'Referral reward earned', 'New proof submitted', 'Payout needs attention'],
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $data = $request->validate(['event' => ['required', 'in:welcome,reserved,proof_submitted,proof_approved,changes_requested,payout_processing,payout_paid,payout_failed']]);
        $examples = [
            'welcome' => new EventNotification('Welcome to Click & Earn', 'Discover available tasks and track your earnings in one place.', 'success', ['event_key' => 'welcome.preview']),
            'reserved' => new EventNotification('Your reward has been reserved', 'Complete the purchase and submit proof before the deadline.', 'warning', ['event_key' => 'reservation.created.preview', 'task' => 'Digital Marketing Toolkit', 'reimbursement_amount' => '47.00', 'incentive_amount' => '10.00', 'expected_payout' => '57.00', 'currency' => 'USD', 'expires_at' => now()->addDays(3)->format('M j, Y g:i A')]),
            'proof_submitted' => new EventNotification('Proof submitted', 'Your proof was received and is under review.', 'processing', ['event_key' => 'proof.submitted.member.preview', 'task' => 'Digital Marketing Toolkit']),
            'proof_approved' => new EventNotification('Proof approved', 'Your proof was approved. Your payout is now queued.', 'success', ['event_key' => 'proof.approved.preview', 'task' => 'Digital Marketing Toolkit', 'reimbursement_amount' => '47.00', 'incentive_amount' => '10.00', 'expected_payout' => '57.00', 'currency' => 'USD']),
            'changes_requested' => new EventNotification('Changes requested', 'Please review the requested changes and update your proof.', 'warning', ['event_key' => 'proof.changes_requested.preview', 'task' => 'Digital Marketing Toolkit', 'reviewer_note' => 'Please upload a clearer receipt image.']),
            'payout_processing' => new EventNotification('Your payout is processing', 'Your payout has been sent for processing.', 'processing', ['event_key' => 'payout.processing.preview', 'amount' => '57.00', 'currency' => 'USD', 'reference' => 'PAY-EXAMPLE-001', 'masked_account' => '****1234']),
            'payout_paid' => new EventNotification('Payout paid', 'Your payout has been confirmed as paid.', 'success', ['event_key' => 'payout.paid.preview', 'amount' => '57.00', 'currency' => 'USD', 'reference' => 'PAY-EXAMPLE-001', 'masked_account' => '****1234']),
            'payout_failed' => new EventNotification('Payout needs attention', 'Your payout needs attention. Please review your payout method.', 'error', ['event_key' => 'payout.failed.preview', 'amount' => '57.00', 'currency' => 'USD', 'reference' => 'PAY-EXAMPLE-001']),
        ];
        $notification = $examples[$data['event']];

        return $this->ok(['html' => view('emails.transactional', $notification->payloadFor($request->user()))->render()]);
    }

    public function sendTestEmail(Request $request): JsonResponse
    {
        try {
            $request->user()->notifyNow(new EventNotification(
                'Click & Earn email test',
                'This is a controlled test of your Click & Earn transactional email configuration.',
                'success',
                ['event_key' => 'email.test'],
            ));
        } catch (Throwable $exception) {
            Log::warning('Admin email test failed.', ['admin_id' => $request->user()->id, 'exception' => $exception::class]);

            return response()->json(['message' => 'Test email could not be sent. Check the server mail configuration and recent delivery failures.'], 422);
        }

        return $this->message('Test email sent successfully.');
    }
}
