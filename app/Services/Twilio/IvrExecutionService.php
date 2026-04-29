<?php

namespace App\Services\Twilio;

use App\Models\IvrFlow;
use App\Models\IvrNode;
use App\Support\WebhookUrl;
use Twilio\TwiML\VoiceResponse;

/**
 * Walks an IvrFlow graph one node at a time, returning the TwiML for
 * the requested node. Twilio's webhook tells us which flow + node to render
 * after each <Gather>; we don't try to hold the entire flow in memory between
 * webhook calls — each call is stateless.
 */
class IvrExecutionService
{
    public function renderEntry(IvrFlow $flow): VoiceResponse
    {
        $entry = $flow->entry_node_id ? IvrNode::find($flow->entry_node_id) : $flow->nodes()->orderBy('id')->first();
        if (!$entry) {
            $r = new VoiceResponse();
            $r->say('This phone menu has no entry. Goodbye.');
            $r->hangup();
            return $r;
        }
        return $this->renderNode($entry);
    }

    public function renderNode(IvrNode $node): VoiceResponse
    {
        $cfg = $node->config ?? [];
        $r = new VoiceResponse();

        switch ($node->type) {
            case 'say':
                $r->say((string) ($cfg['text'] ?? ''), self::sayAttrs($cfg));
                $this->appendNext($r, $node, (int) ($cfg['next_node_id'] ?? 0));
                break;

            case 'play':
                $r->play((string) ($cfg['url'] ?? ''));
                $this->appendNext($r, $node, (int) ($cfg['next_node_id'] ?? 0));
                break;

            case 'gather':
                $this->renderGather($r, $node, $cfg);
                break;

            case 'dial':
                $dial = $r->dial('', [
                    'action' => $this->urlFor($node, 'after-dial'),
                    'method' => 'POST',
                    'timeout' => (int) ($cfg['timeout'] ?? 20),
                ]);
                if (!empty($cfg['to_e164'])) {
                    $dial->number((string) $cfg['to_e164']);
                } elseif (!empty($cfg['client_identity'])) {
                    $dial->client((string) $cfg['client_identity']);
                }
                break;

            case 'record':
                $r->record([
                    'maxLength' => (int) ($cfg['max_length'] ?? 60),
                    'finishOnKey' => (string) ($cfg['finish_on_key'] ?? '#'),
                    'transcribe' => (bool) ($cfg['transcribe'] ?? false),
                    'action' => $this->urlFor($node, 'after-record'),
                    'method' => 'POST',
                ]);
                break;

            case 'voicemail':
                if (!empty($cfg['greeting_url'])) {
                    $r->play((string) $cfg['greeting_url']);
                } else {
                    $r->say((string) ($cfg['greeting_text'] ?? 'Please leave a message after the beep.'));
                }
                $r->record([
                    'maxLength' => 120,
                    'finishOnKey' => '#',
                    'transcribe' => true,
                    'transcribeCallback' => WebhookUrl::for('webhooks/twilio/voice/voicemail'),
                    'action' => WebhookUrl::for('webhooks/twilio/voice/voicemail'),
                    'method' => 'POST',
                    'recordingStatusCallback' => WebhookUrl::for('webhooks/twilio/voice/recording'),
                ]);
                break;

            case 'queue':
                $r->enqueue((string) ($cfg['queue_name'] ?? 'support'));
                break;

            case 'goto':
                $target = (int) ($cfg['target_node_id'] ?? 0);
                if ($target > 0) {
                    $next = IvrNode::find($target);
                    if ($next) return $this->renderNode($next);
                }
                $r->hangup();
                break;

            case 'condition':
                // Conditions are evaluated at handle-time when we know the digits;
                // this branch should never hit during direct rendering.
                $r->hangup();
                break;

            case 'hangup':
            default:
                if (!empty($cfg['text'])) $r->say((string) $cfg['text']);
                $r->hangup();
                break;
        }

        return $r;
    }

    /** Handles a Gather/Record callback for a node based on Digits/SpeechResult. */
    public function handleNodeCallback(IvrNode $node, array $params, string $action = 'handle'): VoiceResponse
    {
        $cfg = $node->config ?? [];
        $digits = (string) ($params['Digits'] ?? '');
        $speech = (string) ($params['SpeechResult'] ?? '');

        if ($action === 'after-dial' || $action === 'after-record') {
            $next = (int) ($cfg['next_node_id'] ?? 0);
            if ($next) {
                $node = IvrNode::find($next);
                if ($node) return $this->renderNode($node);
            }
            $r = new VoiceResponse();
            $r->hangup();
            return $r;
        }

        // Default: gather handling.
        $branches = $cfg['branches'] ?? []; // [{digits, target_node_id, contains?}]
        foreach ($branches as $b) {
            $matchDigits = (string) ($b['digits'] ?? '');
            $contains = (string) ($b['contains'] ?? '');
            if ($matchDigits !== '' && $matchDigits === $digits) {
                $next = IvrNode::find((int) ($b['target_node_id'] ?? 0));
                if ($next) return $this->renderNode($next);
            }
            if ($contains !== '' && $speech !== '' && mb_stripos($speech, $contains) !== false) {
                $next = IvrNode::find((int) ($b['target_node_id'] ?? 0));
                if ($next) return $this->renderNode($next);
            }
        }

        // Fallback path
        $fallbackId = (int) ($cfg['fallback_node_id'] ?? 0);
        if ($fallbackId) {
            $next = IvrNode::find($fallbackId);
            if ($next) return $this->renderNode($next);
        }

        $r = new VoiceResponse();
        $r->say('Sorry, I didn\'t catch that. Goodbye.');
        $r->hangup();
        return $r;
    }

    private function renderGather(VoiceResponse $r, IvrNode $node, array $cfg): void
    {
        $gatherAttrs = [
            'numDigits' => (int) ($cfg['num_digits'] ?? 1),
            'timeout' => (int) ($cfg['timeout'] ?? 5),
            'action' => $this->urlFor($node, 'handle'),
            'method' => 'POST',
        ];
        if (!empty($cfg['speech'])) {
            $gatherAttrs['input'] = 'speech dtmf';
            if (!empty($cfg['language'])) $gatherAttrs['language'] = (string) $cfg['language'];
        }
        if (isset($cfg['finish_on_key'])) $gatherAttrs['finishOnKey'] = (string) $cfg['finish_on_key'];

        $gather = $r->gather($gatherAttrs);
        $prompt = (string) ($cfg['prompt_text'] ?? '');
        $promptUrl = (string) ($cfg['prompt_audio_url'] ?? '');
        if ($promptUrl !== '') {
            $gather->play($promptUrl);
        } elseif ($prompt !== '') {
            $gather->say($prompt, self::sayAttrs($cfg));
        }

        // Repeat once, then fall through to fallback
        if (!empty($cfg['repeat_on_timeout'])) {
            if ($promptUrl !== '') $r->play($promptUrl);
            elseif ($prompt !== '') $r->say($prompt, self::sayAttrs($cfg));
        }

        $fallbackId = (int) ($cfg['fallback_node_id'] ?? 0);
        if ($fallbackId) {
            $r->redirect($this->urlForNode($fallbackId), ['method' => 'POST']);
        } else {
            $r->say('Sorry, I didn\'t catch that. Goodbye.');
            $r->hangup();
        }
    }

    private function appendNext(VoiceResponse $r, IvrNode $node, int $nextId): void
    {
        if ($nextId > 0) {
            $r->redirect($this->urlForNode($nextId), ['method' => 'POST']);
        } else {
            $r->hangup();
        }
    }

    private function urlFor(IvrNode $node, string $action): string
    {
        return WebhookUrl::for("webhooks/twilio/ivr/{$node->ivr_flow_id}/{$node->id}/{$action}");
    }

    private function urlForNode(int $id): string
    {
        $node = IvrNode::find($id);
        if (!$node) return WebhookUrl::for('webhooks/twilio/voice/incoming');
        return WebhookUrl::for("webhooks/twilio/ivr/{$node->ivr_flow_id}/{$node->id}/render");
    }

    private static function sayAttrs(array $cfg): array
    {
        $attrs = [];
        if (!empty($cfg['voice'])) $attrs['voice'] = (string) $cfg['voice'];
        if (!empty($cfg['language'])) $attrs['language'] = (string) $cfg['language'];
        return $attrs;
    }
}
