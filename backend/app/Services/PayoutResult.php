<?php

namespace App\Services;

final class PayoutResult
{
    public function __construct(
        public readonly string $status,
        public readonly ?string $reference = null,
        public readonly ?string $message = null,
        public readonly array $raw = [],
    ) {
    }

    public function isPaid(): bool
    {
        return $this->status === 'paid';
    }

    public function isProcessing(): bool
    {
        return $this->status === 'processing';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }
}
