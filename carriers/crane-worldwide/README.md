# Crane Worldwide

Crane Worldwide shipments use enabled universal providers. There is no dedicated adapter.

Crane Worldwide Logistics is a freight forwarder based in Houston, Texas, with air, ocean, road
and e-commerce shipping, including parcel and returns operations. Its site is craneww.com.

## Numbers

Crane Worldwide publishes no number format, and no public page shows one of its tracking numbers,
so there is no rule.

## Why there is no adapter

Its public tracker on webtracker.craneww.com loads a shipment into the page with an HTMX GET of
`/v2/Shipments?TrackingNumber=<number>`, open without a session or CAPTCHA, with no page or
address per number. The reply is an HTML fragment; an unknown number gets "0 shipments/loads
matched the tracking #" and an empty list. No public number is known to see a found reply.

## Links

No tracking link is known.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
