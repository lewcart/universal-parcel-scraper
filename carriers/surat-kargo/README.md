# Sürat Kargo

Sürat Kargo parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

The tracker and customers use fourteen-digit tracking numbers. Fourteen digits are shared with
Russian Post and other carriers, and no checksum is known, so no rule claims them. The tracker
also takes the sender's web order code, which is not a tracking number.

## Links

The tracker reads the number from `kargotakipno`, so
`suratkargo.com.tr/KargoTakip/?kargotakipno={number}` opens one parcel, as archived lookups
show.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
