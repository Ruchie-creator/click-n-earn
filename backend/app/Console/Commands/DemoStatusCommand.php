<?php

namespace App\Console\Commands;

use App\Services\DemoDataService;
use Illuminate\Console\Command;

class DemoStatusCommand extends Command
{
    protected $signature = 'demo:status';

    protected $description = 'Show the controlled client-preview demo dataset status';

    public function handle(DemoDataService $demo): int
    {
        try {
            $status = $demo->status();
        } catch (\Throwable $exception) {
            $this->error('Demo status is unavailable: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->line('Client preview controls: '.($status['enabled'] && $status['client_preview'] ? 'enabled' : 'disabled'));
        $this->line('Demo batch: '.$status['batch_label'].' ('.($status['installed'] ? 'installed' : 'not installed').')');
        $this->table(['Demo records', 'Count'], array_map(
            static fn (string $key, int $count): array => [str_replace('_', ' ', ucfirst($key)), $count],
            array_keys($status['counts']),
            array_values($status['counts']),
        ));

        return self::SUCCESS;
    }
}
