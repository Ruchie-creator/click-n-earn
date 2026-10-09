<?php

namespace App\Enums;

enum LedgerType: string
{
    case TASK_REIMBURSEMENT = 'task_reimbursement';
    case TASK_INCENTIVE = 'task_incentive';
    case REFERRAL_REWARD = 'referral_reward';
    case ADJUSTMENT = 'adjustment';
    case PAYOUT = 'payout';
}
