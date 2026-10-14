<?php

namespace App\Console\Commands;

use App\Services\DemoDataService;
use Illuminate\Console\Command;

class DemoRefreshCommand extends Command
{
    protected $signature = 'demo:refresh {--force : Refresh the configured preview catalog without an interactive confirmation}';

    protected $description = 'Replace the tagged preview batch with the catalog-only sample data';

    public function handle(DemoDataService $demo): int
    {
        if (! $this->option('force') && ! $this->confirm('Replace only the configured preview batch with catalog-only sample data?', false)) {
            $this->comment('Catalog refresh cancelled.');

            return self::SUCCESS;
        }

        try {
            $status = $demo->refresh();
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info('Catalog-only preview batch is ready: '.$status['batch_label']);
        $this->table(['Catalog records', 'Count'], array_map(
            static fn (string $key, int $count): array => [str_replace('_', ' ', ucfirst($key)), $count],
            array_keys($status['counts']),
            array_values($status['counts']),
        ));

        return self::SUCCESS;
    }
}
