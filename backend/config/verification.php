<?php

return [
    'allowed_proof_mimes' => ['jpg', 'jpeg', 'png', 'pdf'],
    'max_proof_size_kb' => (int) env('MAX_PROOF_SIZE_KB', 10240),
    'auto_review_threshold' => (float) env('RECEIPT_AUTO_REVIEW_THRESHOLD', 0.85),
];
