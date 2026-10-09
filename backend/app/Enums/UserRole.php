<?php

namespace App\Enums;

enum UserRole: string
{
    case MEMBER = 'member';
    case ADMIN = 'admin';
    case SUPER_ADMIN = 'super_admin';
}
