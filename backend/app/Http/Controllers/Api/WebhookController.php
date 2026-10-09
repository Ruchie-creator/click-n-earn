<?php

namespace App\Http\Controllers\Api;

use App\Jobs\ProcessAirwallexWebhookJob;
use App\Models\WebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use JsonException;

class WebhookController extends ApiController
{
    public function airwallex(Request $request): JsonResponse
    {
        $raw = $request->getContent();
        $timestamp = (string) $request->header('x-timestamp');
        $signature = (string) $request->header('x-signature');
        $secret = (string) config('payout.airwallex.webhook_secret');

        abort_if(blank($secret) || blank($timestamp) || blank($signature), 401, 'Invalid webhook signature.');
        $timestampSeconds = strlen($timestamp) > 10
            ? intdiv((int) $timestamp, 1000)
            : (int) $timestamp;
        abort_if(abs(now()->timestamp - $timestampSeconds) > 300, 401, 'Expired webhook signature.');

        $expected = hash_hmac('sha256', $timestamp.$raw, $secret);
        abort_unless(hash_equals($expected, $signature), 401, 'Invalid webhook signature.');

        try {
            $payload = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            abort(400, 'Invalid webhook payload.');
        }
        abort_unless(is_array($payload), 400, 'Invalid webhook payload.');
        $eventId = $request->header('x-event-id')
            ?: data_get($payload, 'id')
            ?: data_get($payload, 'event_id')
            ?: hash('sha256', $raw);
        abort_if(strlen((string) $eventId) > 255, 400, 'Invalid webhook event id.');
        $eventName = (string) ($request->header('x-event-name') ?: data_get($payload, 'name') ?: data_get($payload, 'event_type', 'unknown'));

        $event = WebhookEvent::firstOrCreate(
            ['provider' => 'airwallex', 'event_id' => $eventId],
            [
                'event_name' => $eventName,
                'payload' => $payload,
                'status' => 'received',
                'received_at' => now(),
            ],
        );
        if (in_array($event->status, ['received', 'pending_match', 'failed'], true)) {
            ProcessAirwallexWebhookJob::dispatch($event->id)->afterCommit();
        }

        return $this->message('Webhook received.', 200, ['event_id' => $eventId]);
    }
}
