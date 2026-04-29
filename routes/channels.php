<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('user.{id}', function (User $user, int $id) {
    return (int) $user->id === $id;
});

Broadcast::channel('call.{callId}', function (User $user, int $callId) {
    return $user->calls()->where('id', $callId)->exists() || $user->isAdmin();
});

Broadcast::channel('agents', function (User $user) {
    return [
        'id' => $user->id,
        'name' => $user->name,
        'presence' => $user->presence,
    ];
});
