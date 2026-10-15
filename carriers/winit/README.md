# WINIT

WINIT parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

WINIT's tracker answers for its own processing numbers. China pick-up orders read `ID`,
fourteen digits and a country code; overseas warehouse orders read `WO`, eleven or fourteen
digits and the warehouse country. Both families appear only on WINIT's tracker, so a
high-confidence rule claims each. The tracker also lists the delivering carrier's own number
for tracked services; those numbers stay with that carrier.

## Links

The mobile tracker opens one parcel at
`track.winit.com/tracking/Mobile/result?trackingNos={number}`, the address its own search form
builds. Desktop result pages carry the number after `trackingNoString/` in the path, and the
mobile detail page after `traceDetail/trackingNo/`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
