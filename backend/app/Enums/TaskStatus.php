<?php

namespace App\Enums;

enum TaskStatus: string
{
    case AVAILABLE = 'available';
    case PAUSED = 'paused';
    case EXPIRED = 'expired';
    case ARCHIVED = 'archived';
}
