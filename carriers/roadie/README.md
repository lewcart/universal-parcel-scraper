# Roadie

Roadie deliveries use enabled universal providers. There is no dedicated adapter.

## Numbers

Roadie's tracker takes the delivery id from Roadie's notification links. Lookups archived from
the tracker show two layouts, which its script treats apart: `1R` and 26 letters and digits,
sent in capitals, and `1R` and 14 hexadecimal digits, sent in lower case. `roadie-1` and
`roadie-2` claim them.

## Links

The tracker opens one delivery at `track.roadie.com/id/{number}`. It redirects
`/track/{number}` and `/track?tracking_number=` there, also behind a partner theme prefix.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
