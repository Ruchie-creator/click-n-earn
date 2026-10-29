<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Api\ApiController;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserController extends ApiController
{
    public function index(Request $request, LedgerService $ledger): JsonResponse
    {
        $query = User::query()->whereIn('role', $request->user()->hasRole(UserRole::SUPER_ADMIN) ? ['member', 'admin', 'super_admin'] : ['member', 'admin'])->latest();
        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(function ($builder) use ($search): void {
                $builder->where('name', 'ilike', '%'.$search.'%')
                    ->orWhere('email', 'ilike', '%'.$search.'%');
            });
        }
        if ($request->filled('account_status')) {
            $query->where('account_status', $request->string('account_status')->toString());
        }
        $users = $query->paginate(30);

        return $this->ok([
            'items' => $users->getCollection()->map(fn (User $user): array => array_merge($this->userPayload($user), [
                'tasks_completed' => $user->reservations()->where('status', 'paid')->count(),
                'earned' => (float) $ledger->totals($user)['paid_earnings'],
            ]))->values(),
            'meta' => ['current_page' => $users->currentPage(), 'last_page' => $users->lastPage(), 'total' => $users->total()],
        ]);
    }

    public function show(User $user, LedgerService $ledger): JsonResponse
    {
        return $this->ok(array_merge($this->userPayload($user), [
            'tasks_completed' => $user->reservations()->where('status', 'paid')->count(),
            'earned' => (float) $ledger->totals($user)['paid_earnings'],
        ]));
    }

    public function export(Request $request, LedgerService $ledger): StreamedResponse
    {
        $roles = $request->user()->hasRole(UserRole::SUPER_ADMIN) ? ['member', 'admin', 'super_admin'] : ['member', 'admin'];

        return response()->streamDownload(function () use ($roles, $ledger): void {
            $output = fopen('php://output', 'wb');
            fputcsv($output, ['ID', 'Name', 'Email', 'Phone', 'Country', 'Role', 'Account status', 'Email verified', 'Tasks completed', 'Paid earnings', 'Registered at']);
            User::query()->whereIn('role', $roles)->orderBy('id')->chunkById(200, function ($users) use ($output, $ledger): void {
                foreach ($users as $user) {
                    fputcsv($output, [$user->id, $user->name, $user->email, $user->phone, $user->country, $this->enumValue($user->role), $this->enumValue($user->account_status), $user->email_verified_at?->toIso8601String(), $user->reservations()->where('status', 'paid')->count(), $ledger->totals($user)['paid_earnings'], $user->created_at?->toIso8601String()]);
                }
            });
            fclose($output);
        }, 'click-and-earn-users-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function update(Request $request, User $user, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate([
            'account_status' => ['sometimes', 'string', 'in:active,suspended,pending,disabled'],
            'role' => ['sometimes', 'string', 'in:member,admin,super_admin'],
        ]);
        $this->authorizeUserManagement($request, $user, array_key_exists('role', $data));
        $before = $user->toArray();
        $user->update($data);
        $audit->record('user.updated', $user, $request, before: $before, after: $user->fresh()->toArray(), actorId: $request->user()->id);

        return $this->ok($this->userPayload($user->fresh()));
    }

    public function suspend(Request $request, User $user, AuditLogService $audit): JsonResponse
    {
        $this->authorizeUserManagement($request, $user);
        $before = $user->toArray();
        $user->update(['account_status' => AccountStatus::SUSPENDED]);
        $audit->record('user.suspended', $user, $request, before: $before, after: $user->fresh()->toArray(), actorId: $request->user()->id);

        return $this->ok($this->userPayload($user->fresh()));
    }

    public function activate(Request $request, User $user, AuditLogService $audit): JsonResponse
    {
        $this->authorizeUserManagement($request, $user);
        $before = $user->toArray();
        $user->update(['account_status' => AccountStatus::ACTIVE]);
        $audit->record('user.activated', $user, $request, before: $before, after: $user->fresh()->toArray(), actorId: $request->user()->id);

        return $this->ok($this->userPayload($user->fresh()));
    }

    public function forceDestroy(Request $request, User $user, AuditLogService $audit): JsonResponse
    {
        $data = $request->validate([
            'confirmation' => ['required', 'string', 'max:190'],
        ]);
        $this->authorizeUserManagement($request, $user);

        if (! hash_equals($user->email, $data['confirmation'])) {
            throw ValidationException::withMessages([
                'confirmation' => 'Enter the exact email address to confirm permanent deletion.',
            ]);
        }

        DB::transaction(function () use ($request, $user, $audit): void {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($locked->tasksCreated()->exists()) {
                throw ValidationException::withMessages([
                    'user' => 'This user created tasks and cannot be deleted until those tasks are reassigned or permanently deleted.',
                ]);
            }

            $before = $locked->toArray();
            $audit->record('user.force_deleted', $locked, $request, before: $before, actorId: $request->user()->id);
            $locked->tokens()->delete();
            $locked->notifications()->delete();
            $locked->delete();
        });

        return $this->ok(['deleted' => true]);
    }

    private function authorizeUserManagement(Request $request, User $target, bool $roleChange = false): void
    {
        $actor = $request->user();
        if ($actor->is($target)) {
            abort(403, 'Administrators cannot change their own role or account status.');
        }
        if ($target->hasRole(UserRole::SUPER_ADMIN) && ! $actor->hasRole(UserRole::SUPER_ADMIN)) {
            abort(403, 'Only a super admin can manage a super admin account.');
        }
        if ($roleChange && ! $actor->hasRole(UserRole::SUPER_ADMIN)) {
            $requestedRole = request()->string('role')->toString();
            if ($requestedRole === UserRole::SUPER_ADMIN->value) {
                abort(403, 'Only a super admin can assign the super admin role.');
            }
        }
    }
}
