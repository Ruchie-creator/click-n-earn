<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EventNotification extends Notification
{
    public function __construct(
        public readonly string $title,
        public readonly string $body,
        public readonly string $type = 'info',
        public readonly array $data = [],
    ) {
    }

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
        return (new MailMessage)
            ->subject($this->title)
            ->greeting('Hello '.$notifiable->name.',')
            ->line($this->body)
            ->line('Sign in to Click & Earn to view the latest details.');
    }
}
