# Cargus

Cargus parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Cargus's tracker takes the AWB number. Lookups archived from it show nine and ten digits, one
rising series that reached ten digits in 2023; lookups through the former site's tracking
script, from 2014 to 2016, show three letters, eight digits and a letter. Nine and ten digits
are shared with several carriers and the letter layout has not been seen since 2016, so no rule
claims them and the user picks Cargus.

## Links

Cargus's tracking form sends the number as `tracking_number` to
`www.cargus.ro/personal/urmareste-coletul/`, or to `/en/personal/track-your-parcel/` in
English, so `www.cargus.ro/personal/urmareste-coletul/?tracking_number={number}` opens one
parcel. Lookups archived from the former tracker carry the number as `t` on
`/tracking-romanian/`, which now redirects to the current page.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
