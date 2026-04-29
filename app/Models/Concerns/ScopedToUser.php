<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Adds an `ownedBy(?User)` query scope. Admins see all rows; everyone else
 * is filtered to their own `user_id`. Apply only to models that represent
 * shared communication data (calls, messages, voicemails, contacts) — NOT
 * to per-user settings (call settings, blocklist, IVR, routing, templates).
 */
trait ScopedToUser
{
    public function scopeOwnedBy(Builder $q, ?User $user): Builder
    {
        if ($user?->isAdmin()) {
            return $q;
        }
        return $q->where("{$this->getTable()}.user_id", $user?->id ?? 0);
    }
}
