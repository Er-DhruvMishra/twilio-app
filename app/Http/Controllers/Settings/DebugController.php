<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\ModuleDebugFlag;
use App\Services\Audit\AuditLogger;
use App\Services\Debug\DebugLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DebugController extends Controller
{
    public function index(): JsonResponse
    {
        $existing = ModuleDebugFlag::pluck('enabled', 'module');

        $flags = [];
        foreach (DebugLogger::MODULES as $m) {
            $flags[] = [
                'module' => $m,
                'enabled' => (bool) ($existing[$m] ?? false),
            ];
        }

        return response()->json([
            'flags' => $flags,
            'logFile' => 'storage/logs/module-debug.log',
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'flags' => ['required', 'array'],
            'flags.*.module' => ['required', 'string', 'in:' . implode(',', DebugLogger::MODULES)],
            'flags.*.enabled' => ['required', 'boolean'],
        ]);

        foreach ($validated['flags'] as $row) {
            $previous = ModuleDebugFlag::where('module', $row['module'])->value('enabled') ?? false;
            ModuleDebugFlag::updateOrCreate(
                ['module' => $row['module']],
                [
                    'enabled' => $row['enabled'],
                    'updated_by_user_id' => $request->user()->id,
                ],
            );
            if ((bool) $previous !== (bool) $row['enabled']) {
                AuditLogger::log('debug.flag.set', null, [
                    'module' => $row['module'],
                    'enabled' => (bool) $row['enabled'],
                ]);
            }
        }

        DebugLogger::flush();

        return response()->json(['ok' => true]);
    }

    /**
     * Tail the most recent N lines of the module-debug log. Admin-only.
     */
    public function tail(Request $request): JsonResponse
    {
        $lines = (int) min(max((int) $request->query('lines', 200), 1), 2000);
        $path = self::resolveLogPath();
        if (!$path) {
            return response()->json(['lines' => [], 'note' => 'Log file does not exist yet — debug toggles may all be off, or no traffic has hit a debug-enabled module.']);
        }

        // Cheap tail: read whole file and slice if small; otherwise seek.
        $size = filesize($path) ?: 0;
        if ($size < 1024 * 512) {
            $content = file_get_contents($path) ?: '';
            $rows = preg_split('/\r?\n/', $content) ?: [];
        } else {
            $rows = [];
            $fp = fopen($path, 'r');
            if ($fp) {
                fseek($fp, -1024 * 256, SEEK_END);
                fgets($fp); // discard partial line
                while (($line = fgets($fp)) !== false) $rows[] = rtrim($line);
                fclose($fp);
            }
        }

        $rows = array_values(array_filter($rows, fn ($l) => trim($l) !== ''));
        $tail = array_slice($rows, -$lines);

        return response()->json([
            'lines' => $tail,
            'totalShown' => count($tail),
            'fileSizeBytes' => $size,
            'sourceFile' => basename($path),
        ]);
    }

    public function clear(Request $request): JsonResponse
    {
        // The `daily` channel rotates per-day, so "clear" truncates every
        // module-debug-*.log file in the bucket — not just today's.
        $cleared = 0;
        foreach (glob(storage_path('logs/module-debug*.log')) ?: [] as $f) {
            file_put_contents($f, '');
            $cleared++;
        }
        if ($cleared > 0) {
            AuditLogger::log('debug.log.cleared', null, ['files' => $cleared]);
        }
        return response()->json(['ok' => true, 'filesCleared' => $cleared]);
    }

    /**
     * Find the most recent module-debug log. The channel uses Laravel's
     * `daily` driver which writes to `module-debug-YYYY-MM-DD.log`, not the
     * single `module-debug.log` path the channel config nominally points at.
     */
    private static function resolveLogPath(): ?string
    {
        $candidates = glob(storage_path('logs/module-debug*.log')) ?: [];
        if (empty($candidates)) return null;

        // Sort by mtime descending — today's file is the live one.
        usort($candidates, fn ($a, $b) => filemtime($b) <=> filemtime($a));
        return $candidates[0];
    }
}
