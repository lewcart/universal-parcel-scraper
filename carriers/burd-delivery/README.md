# Burd Delivery

Burd Delivery parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Burd's tracking page asks for the shipment number, eighteen digits by its own script. The
numbers in archived lookups are SSCCs, which any carrier labelling with GS1 codes can print, so
no rule claims them.

## Links

Burd's tracking form sends the number as `code` to `burd.dk/track`, so
`burd.dk/track?code={number}` opens one parcel. The links in Burd's notification emails on
`track.burd.dk` combine an order reference with the parcel code and are not read.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
