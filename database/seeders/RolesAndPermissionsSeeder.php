<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            // Existing baseline (Phase 1+2)
            'manage-team',
            'manage-twilio',
            'manage-ivr',
            'manage-routing',
            'manage-billing',
            'view-analytics',
            'make-calls',
            'send-sms',
            'manage-contacts',
            'manage-templates',
            'send-bulk-sms',
            'view-voicemail',

            // Extension (2026-04-28): per-module permissions
            'use-lookup',
            'view-billing',
            'view-fax',
            'send-fax',
            'view-mail',
            'send-mail',
            'manage-mail-templates',
            'send-bulk-mail',
            'view-mail-stats',
            'manage-mail-suppressions',
            'use-chat',
            'use-rcs',
            'use-whatsapp',
            'use-facebook',
            'use-video',
            'manage-video-rooms',
            'view-video-recordings',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin->syncPermissions($permissions);

        // Agent baseline: communication primitives only. Admins grant
        // module access (lookup/fax/mail/conversations/video) per-user via
        // the Team page's permission editor.
        $agent = Role::firstOrCreate(['name' => 'agent', 'guard_name' => 'web']);
        $agent->syncPermissions([
            'make-calls',
            'send-sms',
            'manage-contacts',
            'view-voicemail',
        ]);
    }
}
