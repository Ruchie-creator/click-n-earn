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

class UserController extends ApiController
{
    public function index(Request $request, LedgerService $ledger): JsonResponse
    {
        $query = User::query()->where('role', 'member')->latest();
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

    private function authorizeUserManagement(Request $request, User $target, bool $roleChange = false): void
    {
        $actor = $request->user();
        if ($actor->is($target)) {
            abort(403, 'Administrators cannot change their own role or account status.');
        }
        if (($roleChange || ! $target->hasRole(UserRole::MEMBER)) && ! $actor->hasRole(UserRole::SUPER_ADMIN)) {
            abort(403, 'Only a super admin can change roles or manage administrator accounts.');
        }
    }
}
