<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DemoBatch extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'slug', 'label', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }
}
