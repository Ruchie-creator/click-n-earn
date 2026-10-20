<?php

namespace App\Http\Controllers\Api;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use App\Notifications\EventNotification;
use App\Services\AuditLogService;
use App\Services\EventNotificationService;
use App\Services\ReferralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuthController extends ApiController
{
    public function register(Request $request, ReferralService $referrals, EventNotificationService $notifications): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'phone' => ['nullable', 'string', 'max:40'],
            'country' => ['nullable', 'string', 'size:2'],
            'referral_code' => ['nullable', 'string', 'max:32'],
        ]);
        $requestedReferralCode = $data['referral_code'] ?? null;

        $user = DB::transaction(function () use ($data, $requestedReferralCode, $referrals): User {
            $data['role'] = UserRole::MEMBER;
            $data['account_status'] = AccountStatus::ACTIVE;
            $data['referral_code'] = $this->uniqueReferralCode();
            $user = User::create($data);
            $referral = $referrals->registerReferral($user, $requestedReferralCode);

            if ($referral) {
                $user->forceFill(['referred_by' => $referral->referrer_id])->save();
            }

            return $user;
        });

        $this->sendVerificationEmail($user, $notifications, false);

        return $this->authResponse($user, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);
        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'The provided credentials are incorrect.']);
        }
        if ($user->account_status !== AccountStatus::ACTIVE) {
            throw ValidationException::withMessages(['email' => 'This account is not active.']);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return $this->authResponse($user, 200, $data['device_name'] ?? 'click-and-earn-web');
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return $this->message('Signed out successfully.');
    }

    public function me(Request $request): JsonResponse
    {
        return $this->ok($this->userPayload($request->user()));
    }

    public function showProfilePhoto(User $user): StreamedResponse
    {
        $path = $user->avatar_path;
        abort_unless(
            is_string($path)
                && str_starts_with($path, 'avatars/'.$user->id.'/')
                && ! str_contains($path, '..')
                && Storage::disk('public')->exists($path),
            404,
        );

        return Storage::disk('public')->response($path, basename($path), [
            'Cache-Control' => 'public, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function updateProfile(Request $request, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'country' => ['sometimes', 'nullable', 'string', 'size:2'],
        ]);
        $user = $request->user();
        $before = $user->toArray();
        $user->fill($data)->save();
        $audit->record('profile.updated', $user, $request, before: $before, after: $user->fresh()->toArray(), actorId: $user->id);

        return $this->ok($this->userPayload($user->fresh()));
    }

    public function updateProfilePhoto(Request $request, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'extensions:jpg,jpeg,png,webp', 'max:5120', 'dimensions:max_width=3000,max_height=3000'],
        ]);

        $user = $request->user();
        $before = $user->toArray();
        $previousPath = $user->avatar_path;
        $newPath = $data['avatar']->storePublicly('avatars/'.$user->id, 'public');
        $user->forceFill(['avatar_path' => $newPath])->save();
        $audit->record('profile.photo_updated', $user, $request, before: $before, after: $user->fresh()->toArray(), actorId: $user->id);

        if ($previousPath && str_starts_with($previousPath, 'avatars/'.$user->id.'/') && ! str_contains($previousPath, '..')) {
            Storage::disk('public')->delete($previousPath);
        }

        return $this->ok($this->userPayload($user->fresh()));
    }

    public function updatePassword(Request $request, EventNotificationService $notifications): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        $request->user()->update(['password' => $data['password']]);
        $notifications->notifyOnce($request->user(), 'password.changed.'.now()->timestamp, new EventNotification(
            'Your password was changed',
            'Your Click & Earn password has been updated successfully.',
            'success',
            ['event_key' => 'password.changed'],
        ));

        return $this->message('Password updated successfully.');
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink($request->only('email'));

        return $this->message('If an account exists for that email, reset instructions have been sent.', 202);
    }

    public function resetPassword(Request $request, EventNotificationService $notifications): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        $status = Password::reset($data, function (User $user, string $password) use ($notifications): void {
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
            $notifications->notifyOnce($user, 'password.changed.reset.'.$user->id.'.'.now()->timestamp, new EventNotification(
                'Your password was changed',
                'Your Click & Earn password has been reset successfully.',
                'success',
                ['event_key' => 'password.changed'],
            ));
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return $this->message('Password reset successfully.');
    }

    public function verifyEmail(Request $request, EventNotificationService $notifications): JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return $this->message('Your email address is already verified.');
        }

        $this->sendVerificationEmail($request->user(), $notifications, true);

        return $this->message('A new verification email has been sent.', 202);
    }

    public function confirmEmail(int $id, string $hash, EventNotificationService $notifications): RedirectResponse
    {
        $user = User::findOrFail($id);
        abort_unless(hash_equals((string) $hash, sha1($user->getEmailForVerification())), 403);

        if ($user->markEmailAsVerified()) {
            $notifications->notifyOnce($user, 'welcome.'.$user->id, new EventNotification(
                'Welcome to Click & Earn',
                'Your email address has been verified. You can now browse available tasks and track your earnings in one place.',
                'success',
                ['event_key' => 'welcome.'.$user->id],
            ));
        }

        return redirect(rtrim((string) config('app.frontend_url'), '/').'/?email_verified=1');
    }

    private function sendVerificationEmail(User $user, EventNotificationService $notifications, bool $isResend): void
    {
        $url = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes((int) config('auth.verification.expire', 60)),
            ['id' => $user->id, 'hash' => sha1($user->getEmailForVerification())],
        );
        $eventKey = $isResend
            ? 'email.verification.resend.'.$user->id.'.'.(string) Str::uuid()
            : 'email.verification.'.$user->id;

        $notifications->notifyOnce($user, $eventKey, new EventNotification(
            'Verify your email address',
            'Verify your email address to secure your account. You can browse available tasks while you complete your account setup.',
            'warning',
            ['event_key' => 'email.verification', 'cta_label' => 'Verify Email Address', 'cta_url' => $url],
        ));
    }

    private function authResponse(User $user, int $status, string $device = 'click-and-earn-web'): JsonResponse
    {
        $token = $user->createToken($device)->plainTextToken;

        return response()->json([
            'data' => [
                'user' => $this->userPayload($user),
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ], $status);
    }

    private function uniqueReferralCode(): string
    {
        do {
            $code = strtoupper(Str::random(8));
        } while (User::where('referral_code', $code)->exists());

        return $code;
    }
}
