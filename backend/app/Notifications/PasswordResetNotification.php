<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordResetNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public function __construct(private readonly string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim((string) config('app.frontend_url'), '/').'/reset-password?token='.urlencode($this->token).'&email='.urlencode((string) $notifiable->getEmailForPasswordReset());

        return (new EventNotification(
            'Reset your password',
            'We received a request to reset your Click & Earn password. This link expires soon for your security.',
            'warning',
            ['event_key' => 'password.reset', 'cta_label' => 'Reset Password', 'cta_url' => $url],
        ))->toMail($notifiable);
    }
}
