<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Structured content is additive. Existing description, instructions,
     * and proof_requirements remain the compatibility source for old tasks.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('tasks', 'content')) {
            Schema::table('tasks', function (Blueprint $table): void {
                $table->jsonb('content')->nullable()->after('proof_requirements');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('tasks', 'content')) {
            Schema::table('tasks', function (Blueprint $table): void {
                $table->dropColumn('content');
            });
        }
    }
};
