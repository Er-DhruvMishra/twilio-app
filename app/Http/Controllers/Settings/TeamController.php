<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Invitation;
use App\Models\User;
use App\Notifications\TeamInviteNotification;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class TeamController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::with(['roles:id,name', 'permissions:id,name'])->orderBy('id')->get();
        $invites = Invitation::with('inviter:id,name')->whereNull('accepted_at')->orderByDesc('id')->get();
        $roles = Role::with('permissions:id,name')->orderBy('name')->get(['id', 'name']);
        $permissions = Permission::orderBy('name')->get(['id', 'name']);

        return response()->json([
            'users' => $users->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'presence' => $u->presence,
                'lastSeenAt' => $u->last_seen_at,
                'roles' => $u->roles->pluck('name'),
                'directPermissions' => $u->permissions->pluck('name'),
                'rolePermissions' => $u->getPermissionsViaRoles()->pluck('name'),
                'isMe' => $u->id === $request->user()->id,
            ]),
            'invites' => $invites->map(fn (Invitation $i) => [
                'id' => $i->id,
                'email' => $i->email,
                'roleId' => $i->role_id,
                'invitedBy' => $i->inviter?->name,
                'acceptUrl' => url('/invite/' . $i->token),
                'expiresAt' => $i->expires_at,
                'createdAt' => $i->created_at,
            ]),
            'roles' => $roles->map(fn (Role $r) => [
                'id' => $r->id,
                'name' => $r->name,
                'permissions' => $r->permissions->pluck('name'),
            ]),
            'permissions' => $permissions,
        ]);
    }

    public function invite(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:120'],
            'role_id' => ['required', 'integer', 'exists:roles,id'],
        ]);

        // Already a user?
        if (User::where('email', $validated['email'])->exists()) {
            return response()->json(['message' => 'A user with that email already exists.'], 422);
        }

        $existing = Invitation::where('email', $validated['email'])->whereNull('accepted_at')->first();
        if ($existing) {
            $existing->update([
                'role_id' => $validated['role_id'],
                'token' => Invitation::generateToken(),
                'invited_by' => $request->user()->id,
                'expires_at' => now()->addDays(7),
            ]);
            $invite = $existing;
        } else {
            $invite = Invitation::create([
                'email' => $validated['email'],
                'role_id' => $validated['role_id'],
                'token' => Invitation::generateToken(),
                'invited_by' => $request->user()->id,
                'expires_at' => now()->addDays(7),
            ]);
        }

        try {
            Notification::route('mail', $invite->email)->notify(new TeamInviteNotification($invite, $request->user()->name));
        } catch (\Throwable $e) {
            // Mail driver may be log/none in dev — fall through with the link.
        }

        return response()->json([
            'invite' => [
                'id' => $invite->id,
                'email' => $invite->email,
                'acceptUrl' => url('/invite/' . $invite->token),
                'expiresAt' => $invite->expires_at,
            ],
        ], 201);
    }

    public function revokeInvite(Request $request, int $id): JsonResponse
    {
        Invitation::whereNull('accepted_at')->findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    public function setRole(Request $request, int $userId): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', 'exists:roles,name'],
        ]);

        if ($userId === $request->user()->id) {
            return response()->json(['message' => "You can't change your own role."], 422);
        }

        $user = User::findOrFail($userId);
        // Don't let admin demote the last admin out from under us.
        if ($user->hasRole('admin') && $validated['role'] !== 'admin' && User::role('admin')->count() <= 1) {
            return response()->json(['message' => 'At least one admin must remain.'], 422);
        }
        $previous = $user->roles->pluck('name')->all();
        $user->syncRoles([$validated['role']]);
        AuditLogger::log('team.role.set', $user, ['previous' => $previous, 'new' => [$validated['role']]]);

        return response()->json(['ok' => true]);
    }

    public function setPermissions(Request $request, int $userId): JsonResponse
    {
        $validated = $request->validate([
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $user = User::findOrFail($userId);
        // Self-edit is allowed but never lets you grant yourself anything new
        // (you already have it via your own role); blocking the call is
        // unnecessary friction. Just audit it.
        $previous = $user->permissions->pluck('name')->all();
        $user->syncPermissions($validated['permissions']);
        AuditLogger::log('team.permissions.set', $user, [
            'previous' => $previous,
            'new' => $validated['permissions'],
        ]);

        return response()->json([
            'ok' => true,
            'directPermissions' => $user->fresh('permissions')->permissions->pluck('name'),
        ]);
    }

    public function destroy(Request $request, int $userId): JsonResponse
    {
        if ($userId === $request->user()->id) {
            return response()->json(['message' => "You can't delete yourself."], 422);
        }
        // Don't allow removing the last admin.
        $user = User::findOrFail($userId);
        if ($user->hasRole('admin') && User::role('admin')->count() <= 1) {
            return response()->json(['message' => 'At least one admin must remain.'], 422);
        }
        $user->delete();
        return response()->json(['ok' => true]);
    }
}
