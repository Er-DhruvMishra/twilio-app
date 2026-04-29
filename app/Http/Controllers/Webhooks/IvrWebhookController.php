<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Models\IvrFlow;
use App\Models\IvrNode;
use App\Services\Twilio\IvrExecutionService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Twilio\TwiML\VoiceResponse;

class IvrWebhookController extends Controller
{
    public function __construct(private IvrExecutionService $ivr) {}

    /** Entry: starts the flow. */
    public function entry(Request $request, int $flow): Response
    {
        $flowModel = IvrFlow::find($flow);
        if (!$flowModel) {
            $r = new VoiceResponse();
            $r->say('That phone menu is no longer available.');
            return self::twiml($r);
        }
        return self::twiml($this->ivr->renderEntry($flowModel));
    }

    /** Render a specific node mid-flow (used by <Redirect>). */
    public function render(Request $request, int $flow, int $node): Response
    {
        $n = IvrNode::where('ivr_flow_id', $flow)->find($node);
        if (!$n) return self::hangup();
        return self::twiml($this->ivr->renderNode($n));
    }

    /** Handle a Gather / Record callback. `action` distinguishes the trigger. */
    public function handle(Request $request, int $flow, int $node, ?string $action = 'handle'): Response
    {
        $n = IvrNode::where('ivr_flow_id', $flow)->find($node);
        if (!$n) return self::hangup();
        return self::twiml($this->ivr->handleNodeCallback($n, $request->all(), $action ?: 'handle'));
    }

    private static function hangup(): Response
    {
        $r = new VoiceResponse();
        $r->hangup();
        return self::twiml($r);
    }

    private static function twiml(VoiceResponse $r): Response
    {
        return response((string) $r, 200, ['Content-Type' => 'text/xml']);
    }
}
