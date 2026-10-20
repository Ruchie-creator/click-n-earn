<?php

namespace Database\Seeders;

use App\Models\Task;
use App\Models\TaskCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class TaskCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $names = Task::query()->whereNotNull('category')->pluck('category')
            ->map(fn (mixed $name): string => trim((string) $name))
            ->filter(fn (string $name): bool => $name !== '')
            ->unique(fn (string $name): string => mb_strtolower($name));

        foreach ($names as $name) {
            $normalized = mb_strtolower($name);
            $category = TaskCategory::query()->whereRaw('LOWER(name) = ?', [$normalized])->first();
            if (! $category) {
                $baseSlug = Str::slug($name) ?: 'category';
                $slug = $baseSlug;
                $suffix = 2;
                while (TaskCategory::query()->where('slug', $slug)->exists()) {
                    $slug = $baseSlug.'-'.$suffix++;
                }
                $category = TaskCategory::query()->create(['name' => mb_substr($name, 0, 80), 'slug' => $slug, 'is_active' => true]);
            }

            Task::query()->whereRaw('LOWER(category) = ?', [$normalized])->whereNull('category_id')->update(['category_id' => $category->id]);
        }
    }
}
