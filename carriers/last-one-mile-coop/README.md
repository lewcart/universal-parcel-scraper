# Last One Mile Co-op

Last One Mile Co-op parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Last One Mile Co-op (ラストワンマイル協同組合) is a cooperative of Japanese local delivery companies. Its
tracker, hosted by Yamato System Development, takes a twelve-digit waybill whose last digit is
the remainder of the first eleven divided by seven, the check Yamato, Sagawa and Japan Post
waybills use. Archived lookups show the parcel accepted at a co-op centre and handed to the
member company that delivers it.

The shape and check digit are shared with those larger carriers, so no rule claims these
numbers.

## Links

The co-op's pages link to an inquiry form at `y-track.jp/ytrack/inqservlet?cd=81118&id=02116`,
and archived lookups add the waybill as `number01`, so
`y-track.jp/ytrack/inqservlet?cd=81118&id=02116&number01={number}` opens one parcel. The form
only works with its query string, so there is no search page without one.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
