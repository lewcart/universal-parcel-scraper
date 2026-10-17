# Direx

Direx parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Direx is a Bulgarian shipping company for online shops. It hands parcels to partner posts and
couriers abroad and gives each one a ten-digit item number; its API reports the partner's own
tracking number beside it. Ten digits are shared with DHL Express waybills and many other
carriers' numeric references, so no rule claims them.

PostOne, a separate brand of the same company with its own tracker, prints item numbers of R
and ten digits. They stay in quarantine here.

## Links

The tracking page opens one or more parcels from its `code` parameter, which its own script
builds from the typed numbers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
