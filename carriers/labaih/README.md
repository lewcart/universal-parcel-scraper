# LaBaih

LaBaih parcels use enabled universal providers. There is no dedicated adapter.

LaBaih is a Saudi delivery company for online shops. Its tracker shows each shipment with the
shop that sent it and its events through LaBaih's distribution centres.

## Numbers

LaBaih numbers are fourteen digits. In archived lookups on its tracker they begin with the date
and time the shipment was created. Fourteen-digit numbers are common to many carriers, so no
rule claims them.

## Links

The tracking box on `mylabaih.com` opens `track.mylabaih.com/track/?cn={number}`, which shows
the history; the library reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
