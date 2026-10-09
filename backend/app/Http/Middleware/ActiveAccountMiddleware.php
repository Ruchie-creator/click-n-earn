<?php

namespace App\Http\Middleware;

use App\Enums\AccountStatus;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ActiveAccountMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(
            $request->user()?->account_status === AccountStatus::ACTIVE,
            403,
            'Your account is not active.',
        );

        return $next($request);
    }
}
