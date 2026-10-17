# SkyKing

SkyKing parcels use enabled universal providers. There is no dedicated adapter.

SkyKing is an Indian courier that delivers documents and parcels door to door through branches
across India. Its tracker answers for consignment numbers.

## Numbers

SkyKing consignment numbers are eight or nine digits. Both are bare digit runs that other
carriers print too, so no rule claims them.

## Links

`skyking.co/track?cno={number}` opens one consignment; the tracker's own share buttons build
that address. The library reads the number from `cno`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
