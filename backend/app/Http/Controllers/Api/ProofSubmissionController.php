<?php

namespace App\Http\Controllers\Api;

use App\Enums\ReservationStatus;
use App\Enums\UserRole;
use App\Jobs\RunReceiptVerificationJob;
use App\Models\ProofSubmission;
use App\Models\TaskReservation;
use App\Models\User;
use App\Notifications\EventNotification;
use App\Services\AuditLogService;
use App\Services\EventNotificationService;
use App\Services\ReceiptVerificationService;
use App\Services\StatusTransitionService;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class ProofSubmissionController extends ApiController
{
    public function store(
        Request $request,
        TaskReservation $reservation,
        StatusTransitionService $transitions,
        AuditLogService $audit,
        EventNotificationService $notifications,
        ReceiptVerificationService $receiptVerification,
    ): JsonResponse {
        abort_unless($reservation->user_id === $request->user()->id, 404);

        $data = $request->validate([
            'proof' => [
                'required',
                'file',
                'max:'.(int) config('verification.max_proof_size_kb', 10240),
                function (string $attribute, mixed $file, \Closure $fail): void {
                    if (! $file instanceof UploadedFile || ! $file->isValid()) {
                        $fail('A valid proof file is required.');

                        return;
                    }

                    $allowed = [
                        'jpg' => ['image/jpeg'],
                        'jpeg' => ['image/jpeg'],
                        'png' => ['image/png'],
                        'pdf' => ['application/pdf'],
                    ];
                    $extension = strtolower($file->getClientOriginalExtension());
                    $mime = strtolower((string) $file->getMimeType());
                    if (! isset($allowed[$extension]) || ! in_array($mime, $allowed[$extension], true)) {
                        $fail('Proof must be a JPG, PNG, or PDF file whose extension matches its content.');
                    }
                },
            ],
            'purchase_amount' => ['required', 'numeric', 'decimal:0,2', 'between:0.01,9999999999.99'],
            'purchase_date' => ['required', 'date'],
            'purchase_time' => ['nullable', 'date_format:H:i'],
            'transaction_reference' => ['required', 'string', 'max:120'],
            'user_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $idempotencyKey = trim((string) $request->header('Idempotency-Key'));
        if (! preg_match('/\A[A-Za-z0-9._:-]{16,128}\z/', $idempotencyKey)) {
            throw ValidationException::withMessages([
                'idempotency_key' => 'A valid Idempotency-Key header between 16 and 128 characters is required.',
            ]);
        }

        /** @var UploadedFile $file */
        $file = $data['proof'];
        $sha256 = hash_file('sha256', $file->getRealPath());
        if (! is_string($sha256)) {
            throw new RuntimeException('The uploaded proof could not be fingerprinted.');
        }
        $reference = preg_replace('/\s+/u', ' ', trim($data['transaction_reference'])) ?: '';
        $referenceKey = hash('sha256', mb_strtolower($reference));
        $fingerprint = hash('sha256', json_encode([
            'reservation_id' => (int) $reservation->id,
            'user_id' => (int) $request->user()->id,
            'file_sha256' => strtolower($sha256),
            'purchase_amount_cents' => Money::toCents($data['purchase_amount']),
            'purchase_date' => date('Y-m-d', strtotime($data['purchase_date'])),
            'purchase_time' => $data['purchase_time'] ?? null,
            'transaction_reference_key' => $referenceKey,
            'user_note' => trim((string) ($data['user_note'] ?? '')),
        ], JSON_THROW_ON_ERROR));

        $existing = ProofSubmission::query()
            ->where('user_id', $request->user()->id)
            ->where('idempotency_key', $idempotencyKey)
            ->first();
        if ($existing) {
            return $this->idempotentResponse($existing, (int) $reservation->id, $fingerprint);
        }

        $disk = (string) config('filesystems.proof_disk');
        $diskConfig = config('filesystems.disks.'.$disk, []);
        if ($disk === '' || $disk === 'public' || data_get($diskConfig, 'visibility') === 'public') {
            throw new RuntimeException('Proof storage must be configured with a private filesystem disk.');
        }

        $storedPath = null;
        try {
            $proof = DB::transaction(function () use (
                $request,
                $data,
                $reservation,
                $file,
                $disk,
                &$storedPath,
                $sha256,
                $reference,
                $referenceKey,
                $fingerprint,
                $idempotencyKey,
                $transitions,
                $audit,
            ): ProofSubmission {
                $locked = TaskReservation::query()->lockForUpdate()->findOrFail($reservation->id);
                abort_unless($locked->user_id === $request->user()->id, 404);

                $existing = ProofSubmission::query()
                    ->where('user_id', $request->user()->id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->lockForUpdate()
                    ->first();
                if ($existing) {
                    $this->assertSameIdempotentRequest($existing, (int) $locked->id, $fingerprint);

                    return $existing;
                }

                if ($locked->expires_at?->isPast()) {
                    throw ValidationException::withMessages(['status' => 'This reservation has expired.']);
                }
                if (! in_array($locked->status, [ReservationStatus::RESERVED, ReservationStatus::CHANGES_REQUESTED], true)) {
                    throw ValidationException::withMessages(['status' => 'Proof cannot be submitted for this reservation right now.']);
                }
                if (ProofSubmission::query()->where('file_sha256', strtolower($sha256))->exists()) {
                    throw ValidationException::withMessages(['proof' => 'This proof file has already been submitted.']);
                }
                if (ProofSubmission::query()->where('is_current', true)
                    ->where('transaction_reference_key', $referenceKey)
                    ->where('task_reservation_id', '!=', $locked->id)
                    ->exists()) {
                    throw ValidationException::withMessages(['transaction_reference' => 'This transaction reference has already been used.']);
                }

                $previous = $locked->latestProofSubmission()->lockForUpdate()->first();
                $version = ((int) $locked->proofSubmissions()->max('version')) + 1;
                $extension = $this->verifiedExtension($file);
                $storedPath = $file->storeAs(
                    'proofs/'.$locked->user_id.'/'.$locked->id,
                    sprintf('v%d-%s.%s', $version, Str::lower((string) Str::uuid()), $extension),
                    $disk,
                );
                if (! is_string($storedPath) || $storedPath === '') {
                    throw new RuntimeException('The proof file could not be stored.');
                }

                if ($previous) {
                    $previous->forceFill(['is_current' => false])->save();
                }

                $proof = ProofSubmission::create([
                    'task_reservation_id' => $locked->id,
                    'user_id' => $locked->user_id,
                    'previous_submission_id' => $previous?->id,
                    'version' => $version,
                    'file_disk' => $disk,
                    'file_path' => $storedPath,
                    'original_file_name' => $this->safeOriginalFileName($file, $extension),
                    'mime_type' => $file->getMimeType(),
                    'file_size' => $file->getSize(),
                    'file_sha256' => strtolower($sha256),
                    'transaction_reference_key' => $referenceKey,
                    'idempotency_key' => $idempotencyKey,
                    'request_fingerprint' => $fingerprint,
                    'is_current' => true,
                    'purchase_amount' => Money::decimal(Money::toCents($data['purchase_amount'])),
                    'purchase_date' => $data['purchase_date'],
                    'purchase_time' => $data['purchase_time'] ?? null,
                    'transaction_reference' => $reference,
                    'user_note' => $data['user_note'] ?? null,
                    'status' => ReservationStatus::PROOF_SUBMITTED->value,
                    'submitted_at' => now(),
                ]);
                if ($batchId = $locked->getAttribute('demo_batch_id')) {
                    $proof->forceFill([
                        'demo_batch_id' => $batchId,
                        'demo_key' => sprintf('proof-reservation-%d-v%d', $locked->id, $version),
                    ])->save();
                }

                $transitions->transition($locked, ReservationStatus::PROOF_SUBMITTED->value, $request->user()->id, 'Proof submitted.', ['proof_submission_id' => $proof->id]);
                $locked->forceFill(['submitted_at' => now()])->save();
                $audit->record('proof.submitted', $proof, $request, after: $proof->toArray(), actorId: $request->user()->id);

                return $proof;
            });
        } catch (QueryException $exception) {
            $this->deleteStoredProof($disk, $storedPath);
            $message = $exception->getMessage();

            if (str_contains($message, 'proof_submissions_user_idempotency_unique')) {
                $existing = ProofSubmission::query()
                    ->where('user_id', $request->user()->id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();
                if ($existing) {
                    return $this->idempotentResponse($existing, (int) $reservation->id, $fingerprint);
                }
            }
            if (str_contains($message, 'proof_submissions_current_file_sha256_unique')) {
                throw ValidationException::withMessages(['proof' => 'This proof file has already been submitted.']);
            }
            if (str_contains($message, 'proof_submissions_current_reference_key_unique')) {
                throw ValidationException::withMessages(['transaction_reference' => 'This transaction reference has already been used.']);
            }

            throw $exception;
        } catch (Throwable $exception) {
            $this->deleteStoredProof($disk, $storedPath);

            throw $exception;
        }

        if ($proof->wasRecentlyCreated) {
            $taskTitle = $reservation->task()->value('title') ?: 'your task';
            $notifications->notifyOnce($request->user(), 'proof.submitted.member.'.$proof->id, new EventNotification(
                'Proof submitted',
                sprintf('Your proof for %s was received and queued for review.', $taskTitle),
                'processing',
                ['proof_submission_id' => $proof->id, 'reservation_id' => $reservation->id],
            ), $proof->getAttribute('demo_batch_id'));
            User::query()->whereIn('role', [UserRole::ADMIN->value, UserRole::SUPER_ADMIN->value])->get()->each(
                fn (User $admin) => $notifications->notifyOnce($admin, 'proof.submitted.admin.'.$proof->id, new EventNotification(
                    'New proof submitted',
                    sprintf('%s submitted proof for %s.', $request->user()->name, $taskTitle),
                    'info',
                    ['proof_submission_id' => $proof->id, 'reservation_id' => $reservation->id],
                ), $proof->getAttribute('demo_batch_id')),
            );
            if ($proof->getAttribute('demo_batch_id')) {
                $receiptVerification->verify($proof);
            } else {
                RunReceiptVerificationJob::dispatch($proof->id)->afterCommit();
            }
        }

        return $this->ok([
            'id' => $proof->id,
            'reservation_id' => $proof->task_reservation_id,
            'status' => $proof->status,
            'version' => $proof->version,
            'original_file_name' => $proof->original_file_name,
        ], $proof->wasRecentlyCreated ? 201 : 200);
    }

    public function download(Request $request, ProofSubmission $proof): mixed
    {
        abort_unless($proof->user_id === $request->user()->id || $request->user()->hasRole('admin', 'super_admin'), 404);
        abort_unless($this->isSafeStoredPath($proof), 404);
        abort_unless(Storage::disk($proof->file_disk)->exists($proof->file_path), 404);

        return Storage::disk($proof->file_disk)->download($proof->file_path, $this->safeStoredName($proof->original_file_name));
    }

    private function idempotentResponse(ProofSubmission $proof, int $reservationId, string $fingerprint): JsonResponse
    {
        $this->assertSameIdempotentRequest($proof, $reservationId, $fingerprint);

        return $this->ok([
            'id' => $proof->id,
            'reservation_id' => $proof->task_reservation_id,
            'status' => $proof->status,
            'version' => $proof->version,
            'original_file_name' => $proof->original_file_name,
        ]);
    }

    private function assertSameIdempotentRequest(ProofSubmission $proof, int $reservationId, string $fingerprint): void
    {
        if ((int) $proof->task_reservation_id !== $reservationId || ! hash_equals((string) $proof->request_fingerprint, $fingerprint)) {
            abort(409, 'This Idempotency-Key was already used with a different proof request.');
        }
    }

    private function verifiedExtension(UploadedFile $file): string
    {
        return match (strtolower((string) $file->getMimeType())) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'application/pdf' => 'pdf',
            default => throw ValidationException::withMessages(['proof' => 'Proof must be a JPG, PNG, or PDF file.']),
        };
    }

    private function safeOriginalFileName(UploadedFile $file, string $extension): string
    {
        $name = basename(str_replace('\\', '/', $file->getClientOriginalName()));
        $stem = pathinfo($name, PATHINFO_FILENAME);
        $stem = preg_replace('/[^\pL\pN._-]+/u', '_', $stem) ?: 'proof';
        $stem = trim(mb_substr($stem, 0, 140), '._-') ?: 'proof';

        return $stem.'.'.$extension;
    }

    private function safeStoredName(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = preg_replace('/[^\pL\pN._-]+/u', '_', $name) ?: 'proof';

        return mb_substr(trim($name, '._-') ?: 'proof', 0, 180);
    }

    private function isSafeStoredPath(ProofSubmission $proof): bool
    {
        $expectedPrefix = sprintf('proofs/%d/%d/', $proof->user_id, $proof->task_reservation_id);

        return str_starts_with($proof->file_path, $expectedPrefix)
            && ! str_contains($proof->file_path, '..')
            && $proof->file_disk !== 'public';
    }

    private function deleteStoredProof(string $disk, ?string $path): void
    {
        if ($path) {
            Storage::disk($disk)->delete($path);
        }
    }
}
