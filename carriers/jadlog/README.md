# Jadlog

Jadlog parcels use enabled universal providers. There is no dedicated adapter.

Jadlog is a Brazilian parcel carrier in the Geopost group, which aggregators also list as DPD
Brazil.

## Numbers

Jadlog's API documentation names a fourteen-character tracking number, the `cte`, issued with
the consignment note, besides a fourteen-character shipment id and a shorter request code.
Archived lookups on Jadlog's tracking form show fourteen-digit `cte` values. Fourteen digits
are also DPD's parcel layout and are printed by several other carriers, so no rule claims them.
The same field takes the sender's CNPJ.

## Links

Jadlog's tracking form sends the number as `cte` to `jadlog.com.br/jadlog/captcha`, and
archived lookups show that address with `?cte=`. The page asks for a CAPTCHA before it shows a
parcel, so the library reads the number from such an address but does not build one.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
