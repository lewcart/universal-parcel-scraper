# Logistiq

Logistiq parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Logistiq is a UAE and Saudi courier and logistics company. Recipients get an airwaybill that
opens Logistiq's tracker, and Logistiq's drivers deliver.

Its airwaybills are seven to nine letters followed by nine digits, and the letters vary from
shipment to shipment. A buyer's question on a marketplace, quoting the tracker link, and the
sample in Logistiq's webhook documentation give them. Two numbers do not show which letters are
fixed, so no rule claims the layout and the gap is declared.

## Links

The tracking page on `logistiq.io/track/` sends the number to
`gecko.logistiq.io/#/order/tracking?awb={number}`, which opens one parcel. The number sits in
the fragment, which the link rule reads.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
