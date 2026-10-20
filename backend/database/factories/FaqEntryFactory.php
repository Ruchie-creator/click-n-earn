<?php

namespace Database\Factories;

use App\Models\FaqEntry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FaqEntry>
 */
class FaqEntryFactory extends Factory
{
    protected $model = FaqEntry::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'category' => 'General',
            'question' => fake()->unique()->sentence(5),
            'answer' => fake()->paragraph(),
            'is_published' => false,
            'sort_order' => fake()->numberBetween(1, 100),
        ];
    }
}
