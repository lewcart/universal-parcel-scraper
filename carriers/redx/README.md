# RedX

RedX parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

RedX tracking IDs seen on its own tracker start with a two-digit year, `A` and the month the
parcel was created, followed by letters and digits, twelve to fourteen characters in all; its
developer documentation prints the same layout. `redx-1` claims it. A newer parcel
carries six digits of date in front of eight letters and digits; one sample shows it, and that
shape is too open for a rule.

## Links

The home page's tracking field sends the ID as `trackingId` to `/track-global-parcel/`, so
`redx.com.bd/track-global-parcel/?trackingId={number}` opens one parcel. Merchants who are
signed in are sent to `/track-parcel/` with the same parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
