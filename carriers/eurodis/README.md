# EURODIS

EURODIS parcels use enabled universal providers. There is no dedicated adapter.

EURODIS is a European parcel and pallet network run from Weinheim that links national carriers,
its members; Austrian Post is the member for Austria and trans-o-flex the member for Germany. A
shipment is carried by the member in the country of dispatch and handed to the member that
delivers it. EURODIS has its own tracker for the whole network.

## Numbers

EURODIS's tracker asks for a 24-digit collo barcode or a thirteen-digit EURODIS shipment
number, and also finds a shipment by the dispatching member's number with its country, or by
the shipper's reference with the destination. A sample result on its own results page shows
both layouts. Austrian Post's tracker follows the barcodes of parcels it sends abroad through
EURODIS, and `austrian-post-3` suggests Austrian Post for 24 digits. Both layouts are lengths
that several carriers' rules take, so no rule claims them for EURODIS and detection does not
offer it. The entry names the network that universal providers report.

## Links

The barcode form on `eurodis.com` sends the number as `trackCollo-input-of` to
`eurodis.com/track-trace`, so
`eurodis.com/track-trace?track_and_trace_hidden_field=trackCollo&trackCollo-input-of={number}`
opens one parcel. Such links, with or without a language folder, are read for EURODIS. The
other search forms post their fields.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
