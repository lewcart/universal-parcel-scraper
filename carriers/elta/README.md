# ELTA Hellenic Post

ELTA Hellenic Post items and ELTA Courier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

ELTA's tracker asks for the item code, which it describes as two Latin letters, nine digits and
two Latin letters, the UPU S10 layout, and ELTA Courier's tracker says most of its shipments
use the same layout. Lookups archived from both trackers show such codes ending `GR`, ELTA
Courier's `NB` numbers among them, and foreign postal items. They stay with the generic postal
carrier, so no rule claims them. ELTA's tracker adds that some items from Germany carry a
twelve-digit code instead.

## Links

ELTA's home page sends a code to `www.elta.gr/track?code={number}` (`/en/track` in English),
and the tracker searches the code it finds in the address. ELTA Courier's search form sends the
number as `br` to `www.elta-courier.gr/search`. Lookups archived from ELTA's former site carry
the code as `qc` on `/el-gr/tabid/93/` and `/en-us/personal/tracktrace.aspx`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
