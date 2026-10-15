# Oak Harbor Freight Lines

Oak Harbor Freight Lines shipments use enabled universal providers. There is no dedicated
adapter.

## Numbers

Oak Harbor tracks less-than-truckload freight by its PRO number. Lookups archived from its own
quick trace page show eight-digit PROs, most starting with 1 or 2 and some with 80 or 81. Eight
digits are shared by many carriers and the PROs carry no check digit, so no rule claims them;
a caller names the carrier or pastes a tracking page link.

## Links

The home page's trace form opens one shipment at `www.oakh.com/quicktrace&PRO={number}`,
with the number inside the path rather than in a query string. The library reads the number
from that address in either case. The tracing page itself loads results by script behind a
Turnstile check.

The public client posts to `/tracingactions.php` with `action: loadTraceDetails`, the whole
PRO in both `traceNum` and `tracePro`, `traceType: OHPRO`, and an empty `traceAccount` for
a guest. `showPrevious` and `showNext` are false. Its generic support message does not
distinguish an unknown PRO from a refused lookup; an HTTP 200 containing that message is
not shipment history. Account and proof-of-delivery actions are separate flows.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
