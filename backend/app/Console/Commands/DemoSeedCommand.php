<?php

namespace App\Console\Commands;

use App\Services\DemoDataService;
use Illuminate\Console\Command;

class DemoSeedCommand extends Command
{
    protected $signature = 'demo:seed';

    protected $description = 'Create or verify the controlled client-preview demo dataset';

    public function handle(DemoDataService $demo): int
    {
        try {
            $status = $demo->seed();
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info('Controlled demo batch is ready: '.$status['batch_label']);
        $this->table(['Demo records', 'Count'], $this->rows($status['counts']));

        return self::SUCCESS;
    }

    /** @return array<int, array{string, int}> */
    private function rows(array $counts): array
    {
        return array_map(
            static fn (string $key, int $count): array => [str_replace('_', ' ', ucfirst($key)), $count],
            array_keys($counts),
            array_values($counts),
        );
    }
}
