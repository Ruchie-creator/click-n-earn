<?php

namespace Tests\Feature;

use App\Models\FaqEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StarterFaqMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_adds_an_idempotent_published_starter_faq_set_when_fewer_than_five_exist(): void
    {
        FaqEntry::query()->delete();
        $migration = require database_path('migrations/2026_10_20_120748_seed_starter_faq_entries.php');

        $migration->up();

        $this->assertDatabaseCount('faq_entries', 8);
        $this->assertSame(8, FaqEntry::query()->where('is_published', true)->count());
        $this->getJson('/api/public/faqs')
            ->assertOk()
            ->assertJsonCount(8, 'data')
            ->assertJsonFragment(['question' => 'How does Click & Earn work?'])
            ->assertJsonFragment(['question' => 'Are earnings or payouts guaranteed?']);

        $migration->up();

        $this->assertDatabaseCount('faq_entries', 8);
    }
}
