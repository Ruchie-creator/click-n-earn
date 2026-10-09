<?php

namespace App\Enums;

enum AccountStatus: string
{
    case ACTIVE = 'active';
    case SUSPENDED = 'suspended';
    case PENDING = 'pending';
    case DISABLED = 'disabled';
}
