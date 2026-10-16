# BRT

Tracks shipment numbers, BRTcodes, BRT parcel IDs and `EOB` customer parcel IDs
through BRT's anonymous detailed event portal. Other shipment references use universal providers.
Universal providers call it BRT Bartolini, its former company name, with the
identifier type in brackets; those names are its aliases.

## How it works

One HTTP request retrieves the event table and shipment metadata. The returned
identifier must exactly match its own metadata field. Shipment numbers use the
form's POST route; BRTcodes use its linked event page. The [official tracking form](https://vas.brt.it/vas/sped_numspe_par.htm?lang=en)
keeps these identifier types separate. The modern consumer portal exposes a shorter
progress view and requires recipient verification for more details; the linked
event portal supplies the scan history without that extra input.
Detection and adapter eligibility use the same catalog shapes, apart from
customer parcel IDs of `EOB` and seventeen digits.

Fifteen-digit parcel IDs, printed on the parcel label, go through the form's
parcel search, which only covers about the last two months. Its result page does
not repeat the parcel ID, so a second request reads the shipment's own parcel
list and the result is accepted only when that list names the requested ID.

The same search finds a customer parcel ID ("ID collo cliente"), the barcode a
sender applies to its parcels. The adapter takes those of `EOB` and seventeen
digits. Because the sender chooses them, no detection rule names BRT for them.
BRT reads them case sensitively. Several shipments can share one, and the
adapter only reads a reply that shows a single shipment.

## Notes

Depot scans can span multiple countries without identifying their time zones.
Clock digits remain local times, while dates without a clock remain provider
text. Neither creates a delivery instant. Source order determines current
status even when the newest clock is unresolved.

Arrival at a locker or BRT-fermopoint means ready for pickup; collection from
it means delivery. A shipment returned to its sender ends with a delivery scan
at the origin depot; after a return scan that delivery reads as returned.
Held-parcel records and links to a delivering partner are not part of the
history.

Recipient details, sender references and shipment identifiers beyond the
requested identifier are excluded from the result.

A negative requires the portal's matching parcel-label error. BRT answers a
shipment number it has not found with its TIS0564 error, "Shipment not found or
still being processed", and the parcel search gives the same sentence without the
code. It also answers a shipment not processed yet and a parcel ID older than the
search reaches, so these exact replies stay inconclusive with the reason
`portal_not_found`. A shipment shown with an empty scan table is a `NoHistoryError`.
Empty replies, redirects and generic HTTP errors remain inconclusive.

Links to the shipment pages (`/vas/sped_…`) and the root of vas.brt.it name
BRT; its other pages, such as pickup orders and help, name none.

## Testing

Set `BRT_TRACKING_NUMBER` to an authorized shipment number, BRTcode or parcel ID and optionally
`BRT_UNKNOWN_NUMBER` to a valid-looking unknown code, then run
`npm run test:carriers:live -- carriers/brt`.
