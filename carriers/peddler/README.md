# Peddler

Peddler parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Peddler is a Dutch urban delivery service that also delivers parcels for Chinese shippers
such as Cainiao and YunExpress. Its label specification gives its own tracking number as `P`
and eighteen digits, which `peddler-1` claims. Cainiao parcels keep the number Cainiao hands
over, `NLEXP`, ten digits and `INTPED`, which Peddler's tracker follows and `peddler-2`
claims.

## Links

Peddler's tracker links one parcel as `track.pdlr.nl/trackntrace/{number}`, as archived
lookups show, and the library reads the number from that address. The address fills the
tracking form with the number, which shows a history only after a Cloudflare Turnstile check.

## Limitations

Peddler's server verifies the Turnstile token before it looks a number up, and the history page
opens only for the number just verified. Peddler's apps are a shopping app and staff apps, and
its shipping API needs a client account, so Peddler stays on universal providers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
