# Team Express

Team Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Team Express is a Dubai courier for domestic and export shipments. Archived lookups on its
tracker show airwaybills of the letters `SMART` and seven digits. An export handed to a partner
abroad also shows that partner's forwarding number, which is not a Team Express number.

The tracker comes from a software vendor whose tracking plugin also runs on other Dubai courier
sites, so the prefix may not be Team Express's alone, and the public numbers are one series
from one period. No rule claims the layout and the gap is declared.

## Links

The tracking form sends the number as `trackno` to `teamexpressme.com/tracking`, so
`teamexpressme.com/tracking?trackno={number}` opens one parcel. Archived lookups use the same
address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
