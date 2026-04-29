<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class InvitationController extends Controller
{
    public function show(string $token): Response|RedirectResponse
    {
        $invite = Invitation::with('inviter:id,name')->where('token', $token)->first();

        $error = null;
        if (!$invite) $error = 'Invitation not found.';
        elseif ($invite->accepted_at) $error = 'This invitation has already been accepted.';
        elseif ($invite->expires_at && $invite->expires_at->isPast()) $error = 'This invitation has expired.';

        return Inertia::render('Auth/InviteAccept', [
            'token' => $token,
            'email' => $invite?->email,
            'roleName' => $invite?->role_id ? Role::find($invite->role_id)?->name : null,
            'inviter' => $invite?->inviter?->name,
            'error' => $error,
        ]);
    }

    public function accept(Request $request, string $token): RedirectResponse
    {
        $invite = Invitation::where('token', $token)->first();
        if (!$invite || $invite->accepted_at || ($invite->expires_at && $invite->expires_at->isPast())) {
            return redirect()->route('login')->withErrors(['email' => 'Invitation is no longer valid.']);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::where('email', $invite->email)->first();
        if ($user) {
            return redirect()->route('login')->withErrors(['email' => 'A user with this email already exists. Please sign in.']);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $invite->email,
            'password' => Hash::make($validated['password']),
        ]);

        if ($invite->role_id) {
            $role = Role::find($invite->role_id);
            if ($role) $user->assignRole($role->name);
        } else {
            $user->assignRole('agent');
        }

        $invite->update(['accepted_at' => now()]);

        event(new Registered($user));
        Auth::login($user);

        return redirect()->intended('/home');
    }
}
