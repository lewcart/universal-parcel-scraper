# GlobalPost

GlobalPost is Auctane's cross-border consolidation service, sold through ShipStation in the
United States and the United Kingdom. It collects parcels at its own facilities and hands them
to a national post or courier in the destination country, whose number the tracker also shows.
Tracked through the page its tracker renders for one number.

## How it works

1. `direct`: one `GET https://www.goglobalpost.com/track-detail/?t={number}`, the address the
   site's tracking form opens. It needs no cookie, token, key or browser. The site renders the
   page on its server: one card with the newest status, the route, the GlobalPost number, the
   final-mile partner and its number, the service and the scans, newest first under a heading
   for each day.
2. `retry`: one more try when the request fails to reach the site or hangs. The first try gets
   half of the budget.

- A number the tracker holds nothing for is redirected to its search page with the same number
  and `status=not_found`, which is not found. A redirect for another number or without that
  status is inconclusive, and one elsewhere, a 404 or a 410 is a moved page. A bot check's page
  is a challenge.
- The page repeats the number it is asked, and also opens a parcel by its partner's number. The
  adapter asks only for GlobalPost's own numbers, and the card counts only when its id and the
  GlobalPost number it shows are the number asked; a page for another number or for several
  parcels is inconclusive.
- The site caches a found page for a few minutes, so a scan can show up late.

## Notes

- Scan clocks are wall clocks without a zone, on the clock of the facility that scanned:
  the delivering post's scans match its own times for the same parcel. A parcel crosses zones,
  so the clocks stay `local_time`, and the page's order stands.
- GlobalPost relays its partners' scans in its own wording, without codes; the wordings are
  mapped and any other goes to the shared wording rules. Arrival at a GlobalPost facility is its
  acceptance, though USPS scans on the way there can come first. Cleared customs puts the
  parcel back in transit. A registration listed after the parcel moved is no step back.
- Places are cut at their first word holding a digit, where the page puts the shipper's ZIP
  code or a facility's cut-off one. "Not Available" is no place.
- The final-mile partner is named only when the catalog knows its exact name and its link, if
  any, is its own; otherwise only its number is kept. The partner's number is the delivery
  tracking number; a USPS routing barcode loses the ZIP code it opens with.
- A parcel sent back to its sender ends with "Delivered", and the page's heading puts that
  delivery at the recipient's town. The scan's own place is the sender's town, as Canada Post's
  return scans for the same parcel confirm. A delivery scan at the sender's town, when sender
  and recipient are in different countries and towns, is `returned`.
- The service and the destination country are kept. The recipient's and shipper's towns, read
  to tell a return, the shipper's ZIP code and the progress rail are not.

## Numbers

GlobalPost's own numbers start with `GP`, four letters naming the service and ten digits, and
end with `US` or `GB` for the origin; `globalpost-1` claims that layout, which no other carrier
uses. Older parcels carry `SDC` and fifteen digits, which the adapter accepts but which are too
rare in public sources to claim. The tracker also finds parcels by USPS-issued S10 numbers on
some services and by the final-mile number; postal detection routes those to their carrier, and
the adapter does not ask for them.

## Links

The tracking form opens `goglobalpost.com/track-detail/?t={number}`; archived lookups also
use `t` on `goglobalpost.com/track/`. The library reads the number from either address.

## Limitations

- No delivery estimate, delivery time, weight, offsets or proof of delivery.
- A return delivered at a place other than the sender's town, or without a place, stays
  delivered; the page has no return wording.
- Expired parcels get the unknown-number answer.

## Testing

`npm run test:carriers:live -- carriers/globalpost`, with `GLOBALPOST_TRACKING_NUMBER` and
optionally `GLOBALPOST_UNKNOWN_NUMBER` set outside the repository.
