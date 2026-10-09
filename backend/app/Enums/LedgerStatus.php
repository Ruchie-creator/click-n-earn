<?php

namespace App\Enums;

enum LedgerStatus: string
{
    case RESERVED = 'reserved';
    case PENDING = 'pending';
    case PROCESSING = 'processing';
    case FAILED = 'failed';
    case PAID = 'paid';
    case REVERSED = 'reversed';
    case CANCELLED = 'cancelled';
}
