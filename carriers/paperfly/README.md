# Paperfly

Paperfly parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Paperfly order numbers join four parts with hyphens: the booking date as day, month and
two-digit year, a serial of four to six digits, and two letter-digit pairs. Paperfly's tracker
also takes the references Daraz gives the parcels it hands to Paperfly, which start with
`PFL-BD-`, two letters and ten digits. `paperfly-1` claims those references and `paperfly-2`
the order numbers.

## Links

The tracking box on paperfly.com.bd opens `go.paperfly.com.bd/track/order/{number}`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
