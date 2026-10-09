<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_outbox', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('event_key', 191);
            $table->string('title', 180);
            $table->text('body');
            $table->string('type', 40)->default('info');
            $table->jsonb('data')->nullable();
            $table->string('email_status', 20)->default('pending');
            $table->unsignedInteger('email_attempts')->default(0);
            $table->timestamp('email_locked_at')->nullable();
            $table->timestamp('email_sent_at')->nullable();
            $table->text('email_last_error')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'event_key'], 'notification_outbox_user_event_unique');
            $table->index(['email_status', 'email_locked_at'], 'notification_outbox_email_dispatch_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_outbox');
    }
};
