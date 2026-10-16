# Correos Express

Tracks 16-digit shipment references through the anonymous public tracking form,
and the 23-digit parcel labels. Other reference formats use the universal
providers. Both lengths end in a GS1 check digit, which detection requires.

## How it works

One form POST returns the shipment label and its scan table. Both the visible
label and hidden shipment field must match the requested reference. No session
bootstrap, postcode or browser is needed.

Alongside it, one GET reads the same history from the Correos group's keyless
localizador (`localizador.correos.es/canonico/eventos_envio_servicio/{number}`),
which correos.es's own tracker reads. It gives each scan its clock to the
second and a situation code such as `X060000V`, but no locality. The form stays
the primary source: the localizador adds seconds, codes and missing
explanations to its rows. When the form fails, or answers for a shipment it has
forgotten, the localizador's history answers alone, without localities.

## Notes

The form looks an input up as a shipment number and as a sender's own reference,
so a short input can return someone else's shipment. That is why the label and
the hidden field must both echo the request. A 23-digit parcel label opens with
the shipment number less its check digit, then gives the parcel's position, the
destination postcode and its own check digit. Its page names that shipment, so
the label is accepted when the hidden field echoes it and the visible label
shows the shipment it opens with, which becomes the canonical number. Several
live replies bind this. A Portuguese label opened with another first digit than
its shipment's, so only the next fourteen digits must agree. The postcode never
leaves the label.

The localizador must echo the whole number. Asked for a label, it names the
label's shipment and lists the label among the shipment's parcels; both are
required. It serves the whole Correos group, so its history alone counts only
when every coded scan has a Correos Express situation code.

A localizador scan pairs with a form row only when the pairing is the only one
possible: a coded scan with the row of the same minute and situation, an
uncoded scan with the one row left in its minute. The localizador has no
admission scan, so admission rows keep their minute. A coded scan in a minute
the form does not show is added.

Scans retain the carrier's newest-first order. Neither source states a zone or
offset, so valid digits remain local time and unresolved labels remain provider
text. The catalog zone is `Europe/Madrid`, and seconds that agree across both
sources are only weak evidence of it: Canary Islands and Portuguese scans may
be on their own clocks, so no instant is derived.
Calendar estimates retain date-only precision while the delivery is active;
estimates older than the latest scan are omitted. A rescheduled round does not establish dispatch.

Only recognized status labels, the locality column and the fixed sentences the
carrier explains each situation with are retained. Anything else after a label
is dropped: a pickup point's name and address, a courier's note, a reason that
names the recipient. A failed delivery round has no label, only a note that
opens with "Su envío no ha podido ser entregado" and then gives the reason; it
is a failed attempt, and the reason is kept only when it is one of the fixed
ones. Other scans with missing or unrecognized labels remain neutral tracking
updates, so an older delivery does not become current. Contact fields, the
delivery PIN and proof of delivery are excluded, as are the localizador's
recipient, reference, cash-on-delivery and parcel fields.

The initial page contains every error message hidden in its markup. A form
negative requires the server-selected no-history code and the matching request
echo. The form gives the same negative for a shipment it has forgotten, so it
is a not-found only when the localizador has no trace of the number either;
when the localizador cannot be read, its failure is the answer.

The Android app tracks through an account-bound API that needs a client code,
and its replies carry recipient details, so it is not used.

## Testing

Set `CORREOS_EXPRESS_TRACKING_NUMBER` to an authorized real reference and optionally
`CORREOS_EXPRESS_UNKNOWN_NUMBER` to a valid-looking unknown reference, then run
`npm run test:carriers:live -- carriers/correos-express`.
