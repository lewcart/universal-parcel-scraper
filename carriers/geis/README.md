# Geis

Geis consignments use enabled universal providers. There is no dedicated adapter.

## Numbers

Geis's tracker takes the consignment number, and Geis publishes no layout. Lookups archived
from it between 2019 and 2025 show eleven digits. One of them falls in a series of PPL parcel
numbers and may be a PPL parcel searched on Geis's site, so it is quarantined. Eleven digits
are shared by several carriers, so no rule claims them and the user picks Geis.

## Links

Geis's tracker opens one consignment at
`www.geis-group.cz/cs/detail-zasilky?packNumber={number}`, the address its own search form
sends; the English page `/en/detail-of-cargo` and the Slovak site's
`www.geis-group.sk/sk/detail-zasielky` take the same parameter. Lookups archived from the
earlier page put the number as `p` on `/cs/sledovani-zasilky`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
