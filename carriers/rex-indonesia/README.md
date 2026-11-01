# REX Indonesia

REX Indonesia parcels use enabled universal providers. There is no dedicated adapter.

REX Indonesia, run by PT Royal Express Indonesia in Jakarta, is an express courier for documents and
parcels within Indonesia and abroad, with its own counters and agents. Its site is rex.co.id.

## Numbers

Its tracker takes the air waybill (konosemen) number. Its waybills have fourteen digits starting
22201, and `rex-indonesia-1` suggests REX Indonesia for them at low confidence, as many carriers'
rules read fourteen digits. Older waybills have twelve digits, a shape many carriers share, so no
rule claims them.

## Why there is no adapter

The tracker is a plain page that reads the number from its address and draws a shipment's history on
the server without a session or CAPTCHA. It also shows the sender's and recipient's names, which an
adapter must drop. An adapter can follow.

## Links

Tracking links carry the number as `airwaybill` on the Indonesian or English tracking page. The home
page's form posts to the same page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
