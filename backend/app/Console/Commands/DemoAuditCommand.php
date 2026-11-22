<?php

namespace App\Console\Commands;

use App\Services\DemoDataService;
use Illuminate\Console\Command;

class DemoAuditCommand extends Command
{
    protected $signature = 'demo:audit {--json : Emit the read-only audit as JSON}';

    protected $description = 'Audit tagged client-preview records without changing data';

    public function handle(DemoDataService $demo): int
    {
        try {
            $audit = $demo->audit();
        } catch (\Throwable $exception) {
            $this->error('Demo audit is unavailable: '.$exception->getMessage());

            return self::FAILURE;
        }

        if ($this->option('json')) {
            $this->line((string) json_encode($audit, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return self::SUCCESS;
        }

        $this->line('Client preview batch: '.$audit['batch_label'].' ('.($audit['installed'] ? 'installed' : 'not installed').')');
        $this->table(['Demo records', 'Count'], array_map(
            static fn (string $key, int $count): array => [str_replace('_', ' ', ucfirst($key)), $count],
            array_keys($audit['counts']),
            array_values($audit['counts']),
        ));
        $this->line('Expected payout total: '.number_format((float) $audit['reservations']['expected_payout'], 2));
        $this->line('Tagged payout total: '.number_format((float) $audit['payouts']['total_amount'], 2));
        $this->line('Tagged ledger total: '.number_format((float) $audit['ledger_entries']['total_amount'], 2));
        $this->line('Read-only cleanup preview: '.($audit['cleanup']['can_clear'] ? 'safe to clear after explicit confirmation' : 'blocked'));
        foreach ($audit['cleanup']['blockers'] as $blocker) {
            $this->warn('Blocker: '.$blocker);
        }

        return self::SUCCESS;
    }
}
