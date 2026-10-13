<?php

namespace App\Enums;

enum PayoutStatus: string
{
    case APPROVED = 'approved';
    case RECONCILIATION_REQUIRED = 'reconciliation_required';
    case PROCESSING = 'processing';
    case SENT = 'sent';
    case PAID = 'paid';
    case FAILED = 'failed';
    case CANCELLED = 'cancelled';
    case REVERSED = 'reversed';
}
