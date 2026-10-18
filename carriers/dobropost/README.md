# DobroPost

DobroPost parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

DobroPost consolidates goods bought on Chinese marketplaces at its warehouses in China and
carries them to Russia and Belarus, where a domestic carrier such as CDEK can take the last
leg. Its own parcel numbers are DBRPST and ten digits, the layout its tracker and forms ask
for; customers quote them in the carrier's own review topic. The prefix belongs to DobroPost
alone, so a high-confidence rule claims the layout. The Chinese sellers' numbers that reach its
warehouses and the domestic carrier's numbers stay with their own carriers.

## Links

The tracking page reads the number from its `trackNumber` query parameter and looks it up on
load, so that address opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
