# PostPlus

PostPlus parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

PostPlus (Post+ B.V.) is a postal consolidator with its hub near Amsterdam Schiphol. It sorts
cross-border small packets and parcels and hands them to postal operators and other delivery
companies. Its tracking form's example is a UPU S10 number issued by Lithuania Post. Postal
detection names the issuing post for S10 numbers, so no rule claims them.

## Links

The home page reads a number from its `tracking` parameter and submits its tracking form with
it, so `post.plus/?tracking={number}` opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
