<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MailTemplate;
use App\Services\Mail\SendGridService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MailTemplateController extends Controller
{
    public function __construct(private SendGridService $sg) {}

    public function index(Request $request): JsonResponse
    {
        $templates = MailTemplate::where('user_id', $request->user()->id)
            ->orderBy('name')
            ->get(['id', 'name', 'sg_template_id', 'subject', 'variables', 'last_synced_at', 'updated_at']);

        return response()->json(['templates' => $templates]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'sg_template_id' => ['nullable', 'string', 'max:80'],
            'subject' => ['required', 'string', 'max:500'],
            'body_html' => ['required', 'string'],
            'variables' => ['nullable', 'array'],
        ]);

        $template = MailTemplate::create(array_merge($validated, [
            'user_id' => $request->user()->id,
        ]));

        return response()->json(['template' => $template], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $template = MailTemplate::where('user_id', $request->user()->id)->findOrFail($id);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'sg_template_id' => ['nullable', 'string', 'max:80'],
            'subject' => ['required', 'string', 'max:500'],
            'body_html' => ['required', 'string'],
            'variables' => ['nullable', 'array'],
        ]);
        $template->update($validated);
        return response()->json(['template' => $template]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        MailTemplate::where('user_id', $request->user()->id)->findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    /** Pull dynamic templates from the SendGrid account into local rows. */
    public function syncFromSendGrid(Request $request): JsonResponse
    {
        try {
            $remote = $this->sg->listTemplates();
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        $imported = 0;
        foreach ($remote as $tpl) {
            $sgId = (string) ($tpl['id'] ?? '');
            if (!$sgId) continue;
            $name = (string) ($tpl['name'] ?? 'SendGrid template');
            $version = $tpl['versions'][0] ?? null;
            $subject = (string) ($version['subject'] ?? '');
            $bodyHtml = (string) ($version['html_content'] ?? '');

            MailTemplate::updateOrCreate(
                ['user_id' => $request->user()->id, 'sg_template_id' => $sgId],
                [
                    'name' => $name,
                    'subject' => $subject,
                    'body_html' => $bodyHtml,
                    'last_synced_at' => now(),
                ],
            );
            $imported++;
        }

        return response()->json(['ok' => true, 'imported' => $imported]);
    }
}
