# AAA Cooper

AAA Cooper Transportation shipments use enabled universal providers. There is no dedicated
adapter.

## Numbers

AAA Cooper tracks less-than-truckload freight by its PRO number. Lookups archived from its own
tracking pages show eight- and nine-digit PROs. Both lengths are shared by many carriers, so no
rule claims them; a caller names the carrier or pastes a tracking page link. Pickup numbers
find a shipment on the same page and are not recorded.

## Links

AAA Cooper's Action Trac page opens one shipment at
`aaacooper.com/workspace/action-trac?id={number}&PG=ProNumber`. Older links put the PRO in
`ProNum` on `Transit/ProTrackResults.aspx`, with or without a `pwb/` prefix. The library reads
the number from each form.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
