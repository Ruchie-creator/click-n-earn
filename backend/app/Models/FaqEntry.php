<?php

namespace App\Models;

use Database\Factories\FaqEntryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FaqEntry extends Model
{
    /** @use HasFactory<FaqEntryFactory> */
    use HasFactory;

    protected $fillable = ['category', 'question', 'answer', 'is_published', 'sort_order', 'created_by'];

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'sort_order' => 'integer'];
    }
}
