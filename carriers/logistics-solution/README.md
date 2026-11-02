# Logistics Solution

Logistics Solution (LS Logistics-Solution GmbH) is a forwarder in Cologne that ships parcels from
Germany to Armenia, Belarus, Kazakhstan, Georgia, Central Asia and Russia, with delivery to
Armenian Post branches or by courier. Its site is logistics-solution.eu.

## Retrieval

The tracker is a dialog on the site's pages, with no page or address per number. It asks
`GET /api/tracking?barcode=<number>&language=en` on logistics-solution.eu, and the adapter sends
that one request; no key, cookie, session or browser is needed. The tracker takes any number of
six characters or more in capitals, so the adapter sends one of letters and digits.

The answer is a list whose first entry is the parcel, with the number it was found under and its
events. Only an entry naming the whole number asked is read. HTTP 404 with the site's own JSON
error, `Tracking data not found` or `API returned status 404`, is the tracker's "not found", and
the only one; a parcel without events is one it has no information on yet. Another 404, a block
page and a changed answer keep their failure kinds.

## Notes

- An event's code stages it where the tracker's script draws an icon for it: the prealert to the
  office of exchange as registered, its departure and the delivery depot in transit, the delivery
  as delivered. Another code falls to the shared wording rules on the event's message, and an
  unread one leaves the event without a stage.
- Events are read only with a clock that names its offset; the tracker shows them in the visitor's
  zone. No live answer for a parcel has been seen yet, so another clock is a changed answer.
- A place loses its postcode; one that still holds a number is an address and is left out. The
  sender's and recipient's names, the partner carrying the parcel and weights are never read.

## Numbers

Logistics Solution publishes no number format, and no public page shows one of its tracking
numbers, so there is no rule and recognition never asks the tracker. The tests use made-up
numbers.

## Links

No tracking link is known.

## Testing

`npm run test:carriers:live -- carriers/logistics-solution`, with
`LOGISTICS_SOLUTION_TRACKING_NUMBER` and optionally `LOGISTICS_SOLUTION_UNKNOWN_NUMBER` set
outside the repository.
