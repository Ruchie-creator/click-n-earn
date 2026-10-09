<?php

namespace App\Http\Controllers\Api;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use App\Services\ReferralService;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends ApiController
{
    public function register(Request $request, ReferralService $referrals): JsonResponse
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

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        $request->user()->update(['password' => $data['password']]);

        return $this->message('Password updated successfully.');
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink($request->only('email'));

        return $this->message('If an account exists for that email, reset instructions have been sent.', 202);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        $status = Password::reset($data, function (User $user, string $password): void {
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return $this->message('Password reset successfully.');
    }

    public function verifyEmail(): JsonResponse
    {
        abort(501, 'Email verification is not configured.');
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
