<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\ContactTag;
use App\Services\Contacts\PhoneNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ContactController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $q = trim((string) $request->query('q', ''));
        $tagId = $request->query('tag');

        $with = ['tags:id,name,color'];
        if ($user->isAdmin()) $with[] = 'user:id,name';

        $query = Contact::with($with)
            ->ownedBy($user)
            ->orderBy('display_name');

        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('display_name', 'like', "%{$q}%")
                  ->orWhere('phone_e164', 'like', "%{$q}%")
                  ->orWhere('phone_normalized', 'like', '%' . preg_replace('/\D/', '', $q) . '%')
                  ->orWhere('email', 'like', "%{$q}%");
            });
        }
        if ($tagId) {
            $query->whereHas('tags', fn ($w) => $w->where('contact_tags.id', $tagId));
        }

        return response()->json([
            'contacts' => $query->limit(500)->get()->map(fn (Contact $c) => $this->transform($c, $user->isAdmin())),
            // Tags stay caller-scoped — they're a per-user organizational tool,
            // not a shared concept admin should manage across agents.
            'tags' => ContactTag::where('user_id', $user->id)->orderBy('name')->get(['id', 'name', 'color']),
        ]);
    }

    /**
     * Type-ahead suggestions for the dialer (T9) and SMS To field.
     *
     * Modes:
     *  - Plain text query (e.g. "asha"): name LIKE %query%
     *  - Digits-only query (e.g. "555" or T9 "2742" → "asha"):
     *      a) phone_normalized LIKE %digits%
     *      b) name's letters T9-converted LIKE digits-prefix
     */
    public function suggest(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $q = trim((string) $request->query('q', ''));
        if ($q === '') return response()->json(['suggestions' => []]);

        $isDigitsOnly = (bool) preg_match('/^[\d*#+]+$/', $q);
        $base = Contact::query()
            ->where('user_id', $userId)
            ->limit(8);

        if ($isDigitsOnly) {
            $digits = preg_replace('/\D/', '', $q);
            // OR in two parallel queries: by phone substring AND by T9-name match
            $byPhone = (clone $base)
                ->when($digits !== '', fn ($w) => $w->where('phone_normalized', 'like', "%{$digits}%"))
                ->get();

            // Fetch a candidate set then T9-filter in PHP (cheaper than encoding T9 in SQL).
            $candidates = (clone $base)->limit(200)->get();
            $byT9 = $candidates->filter(fn ($c) => self::nameMatchesT9((string) $c->display_name, $digits))->values();

            $merged = $byPhone->concat($byT9)->unique('id')->take(8);
            return response()->json(['suggestions' => $merged->map(fn ($c) => $this->suggestRow($c))->values()]);
        }

        $rows = $base->where('display_name', 'like', "%{$q}%")
            ->orderBy('display_name')
            ->get();
        return response()->json(['suggestions' => $rows->map(fn ($c) => $this->suggestRow($c))->values()]);
    }

    private function suggestRow(Contact $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->display_name,
            'phone' => $c->phone_e164,
        ];
    }

    private static function nameMatchesT9(string $name, string $digits): bool
    {
        if ($digits === '') return false;
        $key = self::nameToT9($name);
        // Match anywhere in the T9 string — supports searching by surname.
        return str_contains($key, $digits);
    }

    private static function nameToT9(string $name): string
    {
        // Map letters to T9 digits.
        $map = [
            'a' => '2','b' => '2','c' => '2',
            'd' => '3','e' => '3','f' => '3',
            'g' => '4','h' => '4','i' => '4',
            'j' => '5','k' => '5','l' => '5',
            'm' => '6','n' => '6','o' => '6',
            'p' => '7','q' => '7','r' => '7','s' => '7',
            't' => '8','u' => '8','v' => '8',
            'w' => '9','x' => '9','y' => '9','z' => '9',
        ];
        $out = '';
        foreach (str_split(strtolower($name)) as $ch) {
            if (isset($map[$ch])) $out .= $map[$ch];
            elseif (preg_match('/\d/', $ch)) $out .= $ch;
        }
        return $out;
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $with = ['tags:id,name,color'];
        if ($user->isAdmin()) $with[] = 'user:id,name';

        $contact = Contact::with($with)
            ->ownedBy($user)
            ->findOrFail($id);

        if ($user->isAdmin() && $contact->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.contact.show', $contact, ['viewed_user_id' => $contact->user_id]);
        }

        return response()->json(['contact' => $this->transform($contact, $user->isAdmin())]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateInput($request);
        [$e164, $normalized] = PhoneNormalizer::normalize($validated['phone']);

        // Dedupe: if a contact with this normalized number exists, return it.
        $existing = Contact::where('user_id', $request->user()->id)
            ->where('phone_normalized', $normalized)
            ->first();
        if ($existing) {
            return response()->json([
                'contact' => $this->transform($existing->fresh('tags')),
                'duplicate' => true,
            ]);
        }

        $contact = Contact::create([
            'user_id' => $request->user()->id,
            'display_name' => $validated['display_name'],
            'phone_e164' => $e164,
            'phone_normalized' => $normalized,
            'email' => $validated['email'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'is_favorite' => $validated['is_favorite'] ?? false,
            'source' => 'manual',
        ]);

        $contact->tags()->sync($validated['tag_ids'] ?? []);

        return response()->json(['contact' => $this->transform($contact->fresh('tags'))], 201);
    }

    /**
     * Lightweight save-from-list action used by call history / voicemail /
     * messages when the peer isn't already a contact. Only requires a name
     * + phone; everything else is left blank. Returns the contact (creating
     * or returning an existing match).
     */
    public function quickSave(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'display_name' => ['required', 'string', 'max:80'],
            'phone' => ['required', 'string', 'starts_with:+', 'max:32'],
        ]);

        [$e164, $normalized] = PhoneNormalizer::normalize($validated['phone']);

        $contact = Contact::firstOrCreate(
            ['user_id' => $request->user()->id, 'phone_normalized' => $normalized],
            [
                'display_name' => $validated['display_name'],
                'phone_e164' => $e164,
                'source' => 'manual',
            ],
        );

        return response()->json([
            'contact' => $this->transform($contact->fresh('tags')),
            'created' => $contact->wasRecentlyCreated,
        ], $contact->wasRecentlyCreated ? 201 : 200);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $contact = Contact::ownedBy($user)->findOrFail($id);
        if ($user->isAdmin() && $contact->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.contact.update', $contact, ['viewed_user_id' => $contact->user_id]);
        }
        $validated = $this->validateInput($request);
        [$e164, $normalized] = PhoneNormalizer::normalize($validated['phone']);

        $contact->update([
            'display_name' => $validated['display_name'],
            'phone_e164' => $e164,
            'phone_normalized' => $normalized,
            'email' => $validated['email'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'is_favorite' => $validated['is_favorite'] ?? false,
        ]);
        // Tags belong to the contact's owner, not necessarily the editor.
        // If admin edits another user's contact, scope tag-sync to that owner.
        if ($validated['tag_ids'] ?? false) {
            $ownerTagIds = ContactTag::where('user_id', $contact->user_id)
                ->whereIn('id', $validated['tag_ids'])
                ->pluck('id')
                ->all();
            $contact->tags()->sync($ownerTagIds);
        } else {
            $contact->tags()->sync([]);
        }

        return response()->json(['contact' => $this->transform($contact->fresh('tags'), $user->isAdmin())]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $contact = Contact::ownedBy($user)->findOrFail($id);
        if ($user->isAdmin() && $contact->user_id !== $user->id) {
            \App\Services\Audit\AuditLogger::log('view-as-admin.contact.destroy', $contact, ['viewed_user_id' => $contact->user_id]);
        }
        $contact->delete();
        return response()->json(['ok' => true]);
    }

    public function importCsv(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);

        $userId = $request->user()->id;
        $path = $validated['file']->getRealPath();

        $handle = fopen($path, 'r');
        if (!$handle) return response()->json(['message' => 'Could not read upload'], 422);

        $header = array_map('strtolower', array_map('trim', fgetcsv($handle, 0, ',', '"', '\\') ?: []));
        $idxName = self::indexOf($header, ['name', 'display_name', 'fullname']);
        $idxPhone = self::indexOf($header, ['phone', 'phone_e164', 'number', 'mobile']);
        $idxEmail = self::indexOf($header, ['email']);

        if ($idxName === null || $idxPhone === null) {
            fclose($handle);
            return response()->json(['message' => 'CSV needs at least "name" and "phone" columns'], 422);
        }

        $created = 0; $skipped = 0; $rows = 0;

        DB::beginTransaction();
        try {
            while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
                $rows++;
                $name = trim((string) ($row[$idxName] ?? ''));
                $phone = trim((string) ($row[$idxPhone] ?? ''));
                if ($name === '' || $phone === '') { $skipped++; continue; }

                [$e164, $normalized] = PhoneNormalizer::normalize($phone);

                $existing = Contact::where('user_id', $userId)
                    ->where('phone_normalized', $normalized)
                    ->first();
                if ($existing) { $skipped++; continue; }

                Contact::create([
                    'user_id' => $userId,
                    'display_name' => $name,
                    'phone_e164' => $e164,
                    'phone_normalized' => $normalized,
                    'email' => $idxEmail !== null ? trim((string) ($row[$idxEmail] ?? '')) ?: null : null,
                    'source' => 'import',
                ]);
                $created++;
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            fclose($handle);
            return response()->json(['message' => $e->getMessage()], 500);
        }
        fclose($handle);

        return response()->json([
            'message' => "Imported {$created} new contacts ({$skipped} skipped of {$rows} rows).",
            'created' => $created, 'skipped' => $skipped, 'rows' => $rows,
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $user = $request->user();
        $isAdmin = $user->isAdmin();
        return response()->streamDownload(function () use ($user, $isAdmin) {
            $out = fopen('php://output', 'w');
            $header = ['name', 'phone', 'email', 'tags', 'notes', 'favorite'];
            if ($isAdmin) $header[] = 'owner';
            fputcsv($out, $header);
            $with = ['tags:id,name'];
            if ($isAdmin) $with[] = 'user:id,name';
            Contact::with($with)
                ->ownedBy($user)
                ->orderBy('display_name')
                ->chunk(500, function ($chunk) use ($out, $isAdmin) {
                    foreach ($chunk as $c) {
                        $row = [
                            $c->display_name,
                            $c->phone_e164,
                            $c->email ?? '',
                            $c->tags->pluck('name')->implode('|'),
                            $c->notes ?? '',
                            $c->is_favorite ? '1' : '0',
                        ];
                        if ($isAdmin) $row[] = $c->user?->name ?? '';
                        fputcsv($out, $row);
                    }
                });
            fclose($out);
        }, 'contacts.csv', ['Content-Type' => 'text/csv']);
    }

    public function tagsIndex(Request $request): JsonResponse
    {
        return response()->json([
            'tags' => ContactTag::where('user_id', $request->user()->id)->orderBy('name')->get(['id', 'name', 'color']),
        ]);
    }

    public function tagsStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:32'],
            'color' => ['nullable', 'string', 'max:32'],
        ]);
        $tag = ContactTag::firstOrCreate(
            ['user_id' => $request->user()->id, 'name' => $validated['name']],
            ['color' => $validated['color'] ?? 'slate'],
        );
        return response()->json(['tag' => $tag]);
    }

    public function tagsDestroy(Request $request, int $id): JsonResponse
    {
        ContactTag::where('user_id', $request->user()->id)->findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    private function validateInput(Request $request): array
    {
        return $request->validate([
            'display_name' => ['required', 'string', 'max:80'],
            'phone' => ['required', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'is_favorite' => ['nullable', 'boolean'],
            'tag_ids' => ['nullable', 'array'],
            'tag_ids.*' => ['integer'],
        ]);
    }

    private function transform(Contact $c, bool $includeOwner = false): array
    {
        return [
            'id' => $c->id,
            'displayName' => $c->display_name,
            'phoneE164' => $c->phone_e164,
            'email' => $c->email,
            'notes' => $c->notes,
            'isFavorite' => (bool) $c->is_favorite,
            'isBlocked' => (bool) $c->is_blocked,
            'source' => $c->source,
            'tags' => $c->relationLoaded('tags') ? $c->tags->map(fn ($t) => ['id' => $t->id, 'name' => $t->name, 'color' => $t->color]) : [],
            'owner' => $includeOwner && $c->user ? ['id' => $c->user->id, 'name' => $c->user->name] : null,
            'createdAt' => $c->created_at,
        ];
    }

    private static function indexOf(array $haystack, array $candidates): ?int
    {
        foreach ($candidates as $needle) {
            $i = array_search($needle, $haystack, true);
            if ($i !== false) return (int) $i;
        }
        return null;
    }
}
