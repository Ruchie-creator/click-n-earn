<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\NotificationOutbox;
use App\Models\Setting;
use App\Notifications\EventNotification;
use App\Services\AirwallexEnvironment;
use App\Services\AuditLogService;
use App\Services\PayoutAvailability;
use App\Services\PayoutProviderInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class SettingController extends ApiController
{
    public function airwallexStatus(AirwallexEnvironment $environments, PayoutProviderInterface $provider, PayoutAvailability $availability): JsonResponse
    {
        $active = $environments->active();

        return $this->ok([
            'payouts_enabled' => $availability->isEnabled(),
            'active_environment' => $active,
            'sandbox' => $this->airwallexEnvironmentPayload('sandbox', $environments, $provider),
            'live' => $this->airwallexEnvironmentPayload('live', $environments, $provider),
            'readiness' => $this->liveReadiness($environments, $provider),
        ]);
    }

    public function testAirwallexConnection(Request $request, AirwallexEnvironment $environments, PayoutProviderInterface $provider, PayoutAvailability $availability): JsonResponse
    {
        $availability->ensureEnabled();

        $data = $request->validate(['environment' => ['required', 'in:sandbox,live']]);
        $environment = $data['environment'];
        if (! $environments->isConfigured($environment)) {
            return $this->ok(['status' => 'configuration_incomplete']);
        }

        return $this->ok(['status' => $provider->connectionStatus($environment)]);
    }

    public function activateAirwallexEnvironment(Request $request, AirwallexEnvironment $environments, PayoutProviderInterface $provider, AuditLogService $audit, PayoutAvailability $availability): JsonResponse
    {
        $availability->ensureEnabled();

        $data = $request->validate(['environment' => ['required', 'in:sandbox,live'], 'confirmation' => ['nullable', 'string']]);
        $target = $data['environment'];
        if ($target === 'live') {
            abort_unless(($data['confirmation'] ?? null) === 'LIVE', 422, 'Type LIVE to confirm real-money payouts.');
            $readiness = $this->liveReadiness($environments, $provider);
            abort_unless($readiness['ready'], 422, 'Live activation is blocked: '.implode('; ', $readiness['failed_checks']));
        }

        $previous = $environments->active();
        $environments->setActive($target);
        $setting = Setting::firstOrFail(['key' => 'airwallex.environment']);
        $audit->record('airwallex.environment_changed', $setting, $request, before: ['environment' => $previous], after: ['environment' => $target], actorId: $request->user()->id);

        return $this->ok(['active_environment' => $target]);
    }

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

    private function airwallexEnvironmentPayload(string $environment, AirwallexEnvironment $environments, PayoutProviderInterface $provider): array
    {
        $configuration = $environments->configuration($environment);
        $configured = $environments->isConfigured($environment);

        return [
            'configured' => $configured,
            'credentials_configured' => filled($configuration['client_id'] ?? null) && filled($configuration['api_key'] ?? null),
            'webhook_configured' => filled($configuration['webhook_secret'] ?? null),
            'connection' => $configured ? $provider->connectionStatus($environment) : 'configuration_incomplete',
            'base_url' => $configuration['base_url'] ?? null,
        ];
    }

    private function liveReadiness(AirwallexEnvironment $environments, PayoutProviderInterface $provider): array
    {
        $live = $this->airwallexEnvironmentPayload('live', $environments, $provider);
        $appUrl = (string) config('app.url');
        $host = parse_url($appUrl, PHP_URL_HOST);
        $checks = [
            'live client credentials configured' => $live['credentials_configured'],
            'live webhook secret configured' => $live['webhook_configured'],
            'production HTTPS URL configured' => parse_url($appUrl, PHP_URL_SCHEME) === 'https' && filled($host),
            'queue worker expected' => config('queue.default') !== 'sync',
            'scheduler expected' => true,
            'private proof storage configured' => (string) config('filesystems.proof_disk') !== 'public',
            'successful Airwallex authentication test' => $live['connection'] === 'connected',
            'Airwallex-only payout provider enabled' => true,
        ];

        return ['ready' => ! in_array(false, $checks, true), 'checks' => $checks, 'failed_checks' => array_keys(array_filter($checks, fn (bool $passed): bool => ! $passed))];
    }
}
