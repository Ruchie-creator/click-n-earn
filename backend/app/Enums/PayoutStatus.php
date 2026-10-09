<?php

namespace App\Enums;

enum PayoutStatus: string
{
    case APPROVED = 'approved';
    case PROCESSING = 'processing';
    case PAID = 'paid';
    case FAILED = 'failed';
    case CANCELLED = 'cancelled';
    case REVERSED = 'reversed';
}
