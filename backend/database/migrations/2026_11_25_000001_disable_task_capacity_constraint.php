<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Keep the historical counters, but stop the database from rejecting
        // reservations once a legacy slot count has been reached.
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_capacity_within_slots');
    }

    public function down(): void
    {
        $invalidTasks = DB::table('tasks')
            ->whereRaw('reserved_slots < 0 OR completed_slots < 0 OR reserved_slots + completed_slots > available_slots')
            ->count();
        if ($invalidTasks > 0) {
            throw new RuntimeException('Cannot restore task capacity constraints while unlimited reservations exceed legacy slot counts.');
        }

        DB::statement('ALTER TABLE tasks ADD CONSTRAINT tasks_capacity_within_slots CHECK (reserved_slots >= 0 AND completed_slots >= 0 AND reserved_slots + completed_slots <= available_slots)');
    }
};
