# Southwestern Motor Transport

Southwestern Motor Transport shipments use enabled universal providers. There is no dedicated
adapter.

Southwestern Motor Transport (SMT Lines) is a less-than-truckload freight carrier based in San
Antonio, Texas. Its site is smtl.com.

## Numbers

Southwestern Motor Transport publishes no PRO number format, and no public page shows one of its
numbers, so there is no rule.

## Why there is no adapter

Its Shipment Tracing screen is a Profound UI program on profoundui.smtl.com, open without an
account or CAPTCHA. A POST of `program=MWP705C&library=PROFOUNDUI&init=1` and the start page's
parameters to `/profoundui/PUI0001200.pgm` opens a session and returns the screen as JSON; a POST
to that path with the session id and `TRACEBY.FHPRO` traces a Pro. The screen also traces by
interline Pro, bill of lading, purchase order or pickup number. An unknown Pro returns the empty
screen without a message, and no public Pro is known to see a found reply, so neither answer can
be told apart yet. There is no page or address per number. The canary checks the site, smtl.com.

## Links

No tracking link is known.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
