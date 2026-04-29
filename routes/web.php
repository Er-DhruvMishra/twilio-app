<?php

use App\Http\Controllers\Auth\InvitationController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => redirect(auth()->check() ? route('home') : route('login')));

// Public invitation accept (no auth required — they're creating their account)
Route::get('/invite/{token}', [InvitationController::class, 'show'])->name('invite.show');
Route::post('/invite/{token}', [InvitationController::class, 'accept'])->name('invite.accept');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/home', fn () => Inertia::render('Home'))->name('home');

    // Phone app
    Route::prefix('phone')->name('phone.')->group(function () {
        Route::get('/', fn () => Inertia::render('Phone/Dialer'))->name('dialer');
        Route::get('/history', fn () => Inertia::render('Phone/History'))->name('history');
        Route::get('/in-call', fn () => Inertia::render('Phone/InCall'))->name('in-call');
    });

    // Messages app
    Route::prefix('messages')->name('messages.')->group(function () {
        Route::get('/', fn () => Inertia::render('Messages/Threads'))->name('threads');
        Route::get('/compose', fn () => Inertia::render('Messages/Compose'))->name('compose');
        Route::get('/bulk', fn () => Inertia::render('Messages/BulkSend'))->name('bulk');
        Route::get('/{thread}', fn (string $thread) => Inertia::render('Messages/Thread', ['threadKey' => $thread]))->name('thread');
    });

    // Contacts app
    Route::prefix('contacts')->name('contacts.')->group(function () {
        Route::get('/', fn () => Inertia::render('Contacts/Index'))->name('index');
        Route::get('/new', fn () => Inertia::render('Contacts/Edit', ['mode' => 'create']))->name('create');
        Route::get('/import', fn () => Inertia::render('Contacts/Import'))->name('import');
        Route::get('/{id}/edit', fn (int $id) => Inertia::render('Contacts/Edit', ['mode' => 'edit', 'contactId' => $id]))->name('edit');
    });

    // Voicemail app
    Route::get('/voicemail', fn () => Inertia::render('Voicemail/Index'))->name('voicemail.index');
    Route::get('/voicemail/send', fn () => Inertia::render('Voicemail/Send'))->name('voicemail.send');

    // Mic / camera / speaker diagnostic — open to anyone authed.
    Route::get('/diagnostics', fn () => Inertia::render('Diagnostics/Index'))->name('diagnostics');

    // Lookup app
    Route::middleware('can:use-lookup')->prefix('lookup')->name('lookup.')->group(function () {
        Route::get('/', fn () => Inertia::render('Lookup/Index'))->name('index');
        Route::get('/{id}', fn (int $id) => Inertia::render('Lookup/Show', ['lookupId' => $id]))->whereNumber('id')->name('show');
    });

    // Billing app (read-only Twilio Usage)
    Route::middleware('can:view-billing')->get('/billing', fn () => Inertia::render('Billing/Index'))->name('billing.index');

    // Fax app (fax.plus)
    Route::middleware('can:view-fax')->prefix('fax')->name('fax.')->group(function () {
        Route::get('/', fn () => Inertia::render('Fax/Index'))->name('index');
        Route::get('/send', fn () => Inertia::render('Fax/Send'))->middleware('can:send-fax')->name('send');
        Route::get('/{id}', fn (int $id) => Inertia::render('Fax/Show', ['faxId' => $id]))->whereNumber('id')->name('show');
    });

    // Chat app (Twilio Conversations, identity-based)
    Route::middleware('can:use-chat')->prefix('chat')->name('chat.')->group(function () {
        Route::get('/', fn () => Inertia::render('Chat/Threads'))->name('threads');
        Route::get('/new', fn () => Inertia::render('Chat/New'))->name('new');
        Route::get('/{id}', fn (int $id) => Inertia::render('Chat/Thread', ['conversationId' => $id]))->whereNumber('id')->name('thread');
    });

    // RCS app
    Route::middleware('can:use-rcs')->prefix('rcs')->name('rcs.')->group(function () {
        Route::get('/', fn () => Inertia::render('Rcs/Threads'))->name('threads');
        Route::get('/new', fn () => Inertia::render('Rcs/New'))->name('new');
        Route::get('/{id}', fn (int $id) => Inertia::render('Rcs/Thread', ['conversationId' => $id]))->whereNumber('id')->name('thread');
    });

    // WhatsApp app
    Route::middleware('can:use-whatsapp')->prefix('whatsapp')->name('whatsapp.')->group(function () {
        Route::get('/', fn () => Inertia::render('Whatsapp/Threads'))->name('threads');
        Route::get('/new', fn () => Inertia::render('Whatsapp/New'))->name('new');
        Route::get('/{id}', fn (int $id) => Inertia::render('Whatsapp/Thread', ['conversationId' => $id]))->whereNumber('id')->name('thread');
    });

    // Facebook Messenger app
    Route::middleware('can:use-facebook')->prefix('facebook')->name('facebook.')->group(function () {
        Route::get('/', fn () => Inertia::render('Facebook/Threads'))->name('threads');
        Route::get('/new', fn () => Inertia::render('Facebook/New'))->name('new');
        Route::get('/{id}', fn (int $id) => Inertia::render('Facebook/Thread', ['conversationId' => $id]))->whereNumber('id')->name('thread');
    });

    // Video Chat (Twilio Video)
    Route::middleware('can:use-video')->prefix('video')->name('video.')->group(function () {
        Route::get('/', fn () => Inertia::render('Video/Index'))->name('index');
        Route::get('/recordings', fn () => Inertia::render('Video/Recordings'))->middleware('can:view-video-recordings')->name('recordings');
        Route::get('/{id}', fn (int $id) => Inertia::render('Video/Room', ['roomId' => $id]))->whereNumber('id')->name('room');
    });

    // Mail app (SendGrid)
    Route::middleware('can:view-mail')->prefix('mail')->name('mail.')->group(function () {
        Route::get('/', fn () => Inertia::render('Mail/Threads'))->name('threads');
        Route::get('/compose', fn () => Inertia::render('Mail/Compose'))->middleware('can:send-mail')->name('compose');
        Route::get('/stats', fn () => Inertia::render('Mail/Stats'))->middleware('can:view-mail-stats')->name('stats');
        Route::get('/suppressions', fn () => Inertia::render('Mail/Suppressions'))->middleware('can:manage-mail-suppressions')->name('suppressions');
        // Templates and Campaigns must come BEFORE the /{id} catch-all so
        // they don't get swallowed as thread IDs.
        Route::get('/templates', fn () => Inertia::render('Mail/Templates'))->middleware('can:manage-mail-templates')->name('templates');
        Route::get('/campaigns', fn () => Inertia::render('Mail/Campaigns'))->middleware('can:send-bulk-mail')->name('campaigns');
        Route::get('/campaigns/new', fn () => Inertia::render('Mail/CampaignNew'))->middleware('can:send-bulk-mail')->name('campaigns.new');
        Route::get('/campaigns/{id}', fn (int $id) => Inertia::render('Mail/CampaignShow', ['campaignId' => $id]))->whereNumber('id')->middleware('can:send-bulk-mail')->name('campaigns.show');
        Route::get('/{id}', fn (int $id) => Inertia::render('Mail/Thread', ['threadId' => $id]))->whereNumber('id')->name('thread');
    });

    // Settings hub
    Route::prefix('settings')->name('settings.')->group(function () {
        Route::get('/', fn () => Inertia::render('Settings/Index'))->name('index');
        Route::get('/twilio', fn () => Inertia::render('Settings/Twilio'))->name('twilio');
        Route::get('/numbers', fn () => Inertia::render('Settings/NumberPicker'))->name('numbers');
        Route::get('/call', fn () => Inertia::render('Settings/CallSettings'))->name('call');
        Route::get('/blocklist', fn () => Inertia::render('Settings/Blocklist'))->name('blocklist');
        Route::get('/notifications', fn () => Inertia::render('Settings/Notifications'))->name('notifications');
        Route::get('/theme', fn () => Inertia::render('Settings/Theme'))->name('theme');
        Route::get('/auto-reply', fn () => Inertia::render('Settings/AutoReply'))->name('auto-reply');
        Route::get('/templates', fn () => Inertia::render('Settings/Templates'))->name('templates');
        Route::get('/ivr', fn () => Inertia::render('Settings/Ivr/Index'))->name('ivr');
        Route::get('/ivr/{id}', fn (int $id) => Inertia::render('Settings/Ivr/Editor', ['flowId' => $id]))->name('ivr.editor');
        Route::get('/routing', fn () => Inertia::render('Settings/Routing/Index'))->name('routing');
        Route::get('/routing/{id}', fn (int $id) => Inertia::render('Settings/Routing/Edit', ['ruleId' => $id]))->name('routing.edit');
        Route::get('/team', fn () => Inertia::render('Settings/Team'))->middleware('can:manage-team')->name('team');
        Route::get('/analytics', fn () => Inertia::render('Settings/Analytics'))->middleware('can:view-analytics')->name('analytics');
        Route::middleware('can:manage-twilio')->group(function () {
            Route::get('/fax-config', fn () => Inertia::render('Settings/FaxConfig'))->name('fax-config');
            Route::get('/mail-config', fn () => Inertia::render('Settings/MailConfig'))->name('mail-config');
            Route::get('/conversations-config', fn () => Inertia::render('Settings/ConversationsConfig'))->name('conversations-config');
            Route::get('/debug', fn () => Inertia::render('Settings/Debug'))->name('debug');
        });
        Route::middleware('can:manage-team')->group(function () {
            Route::get('/audit-log', fn () => Inertia::render('Settings/AuditLog'))->name('audit-log');
        });
    });

    // Profile (Breeze)
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

// Keep Breeze's expected /dashboard alias redirect
Route::get('/dashboard', fn () => redirect()->route('home'))->middleware(['auth', 'verified'])->name('dashboard');

require __DIR__.'/auth.php';
