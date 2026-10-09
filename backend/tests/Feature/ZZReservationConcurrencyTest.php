<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\TaskReservation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class ZZReservationConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_two_members_racing_for_the_last_slot_create_exactly_one_reservation(): void
    {
        Queue::fake();
        $owner = User::factory()->create();
        $firstMember = User::factory()->create();
        $secondMember = User::factory()->create();
        $task = Task::create([
            'title' => 'Concurrent reservation test',
            'slug' => 'concurrent-reservation-test',
            'description' => 'An isolated test task for simultaneous reservation attempts.',
            'category' => 'testing',
            'external_checkout_url' => 'https://example.invalid/checkout',
            'reimbursement_amount' => '24.00',
            'incentive_amount' => '6.00',
            'expected_payout' => '30.00',
            'available_slots' => 1,
            'instructions' => [],
            'proof_requirements' => [],
            'status' => 'available',
            'starts_at' => now()->subMinute(),
            'expires_at' => now()->addDay(),
            'created_by' => $owner->id,
        ]);

        $userIds = [$owner->id, $firstMember->id, $secondMember->id];
        $barrierPath = sys_get_temp_dir().DIRECTORY_SEPARATOR.'click-earn-race-'.Str::uuid().'.json';
        $connection = DB::connection();
        $processes = [];

        try {
            // Commit only this isolated test fixture so separate worker processes can see it.
            $connection->commit();

            $environment = [
                'APP_ENV' => 'testing',
                'DB_CONNECTION' => 'pgsql',
                'DB_DATABASE' => 'click_and_earn_test',
                'DB_URL' => '',
                'DB_HOST' => (string) config('database.connections.pgsql.host'),
                'DB_PORT' => (string) config('database.connections.pgsql.port'),
                'CACHE_STORE' => 'array',
                'QUEUE_CONNECTION' => 'sync',
                'MAIL_MAILER' => 'array',
                'SESSION_DRIVER' => 'array',
            ];
            $script = dirname(__DIR__).'/Support/reserve_concurrent.php';
            $workingDirectory = dirname(__DIR__, 2);
            foreach ([$firstMember, $secondMember] as $member) {
                $process = new Process([
                    PHP_BINARY,
                    $script,
                    (string) $task->id,
                    (string) $member->id,
                    $barrierPath,
                ], $workingDirectory, $environment);
                $process->setTimeout(30);
                $processes[] = $process;
            }

            $processes[0]->start();
            $processes[1]->start();
            foreach ($processes as $process) {
                $process->wait();
                $this->assertSame(0, $process->getExitCode(), $process->getErrorOutput().$process->getOutput());
            }

            $outcomes = array_map(static fn (Process $process): string => trim($process->getOutput()), $processes);
            sort($outcomes);
            $this->assertSame(['rejected', 'reserved'], $outcomes);
            $this->assertSame(1, TaskReservation::query()->where('task_id', $task->id)->count());
            $this->assertDatabaseHas('tasks', [
                'id' => $task->id,
                'reserved_slots' => 1,
                'completed_slots' => 0,
            ]);
            $this->assertDatabaseCount('ledger_entries', 2);

            $reservation = TaskReservation::query()->where('task_id', $task->id)->firstOrFail();
            $this->assertDatabaseHas('ledger_entries', [
                'user_id' => $reservation->user_id,
                'task_reservation_id' => $reservation->id,
                'amount' => '24.00',
            ]);
            $this->assertDatabaseHas('ledger_entries', [
                'user_id' => $reservation->user_id,
                'task_reservation_id' => $reservation->id,
                'amount' => '6.00',
            ]);
        } finally {
            foreach ($processes as $process) {
                if ($process->isRunning()) {
                    $process->stop(1);
                }
            }

            $reservationIds = DB::table('task_reservations')->where('task_id', $task->id)->pluck('id');
            if ($reservationIds->isNotEmpty()) {
                DB::table('audit_logs')->where('subject_type', TaskReservation::class)->whereIn('subject_id', $reservationIds)->delete();
                DB::table('status_histories')->where('subject_type', TaskReservation::class)->whereIn('subject_id', $reservationIds)->delete();
                DB::table('ledger_entries')->whereIn('task_reservation_id', $reservationIds)->delete();
                DB::table('task_reservations')->whereIn('id', $reservationIds)->delete();
            }
            DB::table('notification_outbox')->whereIn('user_id', $userIds)->delete();
            DB::table('notifications')->where('notifiable_type', User::class)->whereIn('notifiable_id', array_map('strval', $userIds))->delete();
            DB::table('tasks')->where('id', $task->id)->delete();
            DB::table('users')->whereIn('id', $userIds)->delete();
            if (is_file($barrierPath)) {
                unlink($barrierPath);
            }
        }
    }
}
