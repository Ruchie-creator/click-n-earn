<?php

namespace App\Console\Commands;

use App\Services\DemoDataService;
use Illuminate\Console\Command;

class DemoClearCommand extends Command
{
    protected $signature = 'demo:clear {--force : Skip the interactive confirmation for scripted preview cleanup}';

    protected $description = 'Remove only records in the configured client-preview demo batch';

    public function handle(DemoDataService $demo): int
    {
        if (! $demo->controlsAvailable()) {
            try {
                $demo->clear();
            } catch (\Throwable $exception) {
                $this->error($exception->getMessage());

                return self::FAILURE;
            }
        }

        $label = $demo->status()['batch_label'];
        if (! $this->option('force') && ! $this->confirm('Delete only the demo data in "'.$label.'"? This cannot be undone.', false)) {
            $this->comment('Demo cleanup cancelled.');

            return self::SUCCESS;
        }

        try {
            $result = $demo->clear();
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        if (! $result['found']) {
            $this->info('No demo batch was installed; no records were changed.');

            return self::SUCCESS;
        }

        $this->info('Removed only the configured demo batch.');
        $this->line('Synthetic proof files deleted: '.$result['files_deleted']);
        if ($result['files_skipped'] > 0) {
            $this->warn('Some proof files were skipped because their path or storage disk was not safely attributable to this batch.');
        }

        return self::SUCCESS;
    }
}
