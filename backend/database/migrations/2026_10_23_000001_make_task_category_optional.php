<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Categories are retained as legacy metadata for historical records, but
     * task creation and publishing no longer depend on them.
     */
    public function up(): void
    {
        if (Schema::hasColumn('tasks', 'category')) {
            DB::statement('ALTER TABLE tasks ALTER COLUMN category DROP NOT NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('tasks', 'category')) {
            return;
        }

        if (DB::table('tasks')->whereNull('category')->exists()) {
            throw new RuntimeException('Cannot restore the required task category while uncategorized tasks exist. No data was changed.');
        }

        DB::statement('ALTER TABLE tasks ALTER COLUMN category SET NOT NULL');
    }
};
