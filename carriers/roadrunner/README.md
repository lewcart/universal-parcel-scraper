# Roadrunner

Roadrunner shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

Roadrunner tracks less-than-truckload freight by its PRO number, which its integration page
says is nine digits, an eight-digit PRO taking a leading zero. Its tracking API guide shows one
in a sample reply, and lookups archived from its tracking portal show more. Many carriers issue
nine digits, so no rule claims them; a caller names the carrier or pastes a tracking page link.
Eight-digit pickup numbers find a shipment on the same page; they are not recorded.

## Links

Roadrunner's integration page links PROs to
`freight.rrts.com/Tools/Tracking/Pages/MultipleResults.aspx?PROS={number}`; older links use the
same path on `www.rrts.com`. The tracking portal on `tools.rrts.com/LTLTrack/` reads numbers
from `searchValues`. The library reads the number from `PROS` and from `searchValues`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
