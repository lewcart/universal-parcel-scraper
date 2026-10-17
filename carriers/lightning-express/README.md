# Lightning Express

Lightning Express parcels use enabled universal providers. There is no dedicated adapter.

Lightning Express is a last-mile delivery company in Richmond Hill, Ontario that delivers
cross-border e-commerce parcels from its distribution centres with its own drivers.

## Numbers

The tracking field's example is three letters and two digits, an eight-digit date and a
four-digit sequence. The tracker inserts spaces before the last twelve and the last four
characters of any number before it asks its service, so the spaced and unspaced forms are the
same parcel. Only the example shows this layout, so no rule claims it.

## Links

The tracking form opens `lightningexpressca.com/track.html?id={number}`; the library reads the
number from the `id` parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
