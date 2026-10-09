<?php

use App\Models\Task;
use App\Models\User;
use App\Services\TaskReservationService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;

if (getenv('APP_ENV') !== 'testing' || getenv('DB_DATABASE') !== 'click_and_earn_test' || getenv('DB_URL') !== '') {
    throw new RuntimeException('Reservation concurrency workers must use only click_and_earn_test.');
}

$projectRoot = dirname(__DIR__, 2);
require $projectRoot.'/vendor/autoload.php';
$app = require $projectRoot.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
Queue::fake();

[$script, $taskId, $userId, $barrierPath] = $argv;
$barrier = fopen($barrierPath, 'c+');
if ($barrier === false) {
    throw new RuntimeException('Unable to open the test-only process barrier.');
}

if (! flock($barrier, LOCK_EX)) {
    throw new RuntimeException('Unable to lock the test-only process barrier.');
}
rewind($barrier);
$state = json_decode(stream_get_contents($barrier) ?: '', true) ?: ['ready' => 0];
$state['ready']++;
ftruncate($barrier, 0);
rewind($barrier);
fwrite($barrier, json_encode($state, JSON_THROW_ON_ERROR));
fflush($barrier);
flock($barrier, LOCK_UN);

$deadline = microtime(true) + 20;
do {
    flock($barrier, LOCK_SH);
    rewind($barrier);
    $state = json_decode(stream_get_contents($barrier) ?: '', true) ?: ['ready' => 0];
    flock($barrier, LOCK_UN);
    if (($state['ready'] ?? 0) >= 2) {
        break;
    }
    usleep(10000);
} while (microtime(true) < $deadline);
fclose($barrier);

if (($state['ready'] ?? 0) < 2) {
    throw new RuntimeException('Timed out waiting for both reservation competitors.');
}

usleep(random_int(1000, 25000));

try {
    $reservation = app(TaskReservationService::class)->reserve(
        User::query()->findOrFail((int) $userId),
        Task::query()->findOrFail((int) $taskId),
    );
    fwrite(STDOUT, 'reserved');
} catch (ValidationException) {
    fwrite(STDOUT, 'rejected');
} catch (Throwable $exception) {
    fwrite(STDERR, $exception::class.': '.$exception->getMessage());
    exit(1);
}
