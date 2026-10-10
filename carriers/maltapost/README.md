# MaltaPost

MaltaPost items use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from MaltaPost's track-and-trace service show S10 numbers ending `MT`, an S10
number of another post, and once fourteen digits whose issuer is unclear. MaltaPost publishes
no layout of its own, and its tracker accepts any run of letters, digits and hyphens.
International items use the UPU S10 layout and stay with the generic postal carrier. The
fourteen-digit number stays under review.

## Links

MaltaPost's tracker at `www.maltapost.com/tracking` is a single-page app; its own script opens
one item at `www.maltapost.com/tracking#/tracking?barcode={number}`, and the library reads the
number from that fragment.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
