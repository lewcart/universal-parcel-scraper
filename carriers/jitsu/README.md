# Jitsu

Jitsu parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A Trustpilot review gives a Jitsu tracking code of sixteen lower-case letters and digits.
Lookups archived from AxleHire's tracker at `tracking.axlehire.com`, which now forwards to
Jitsu's `tracking.gojitsu.com`, and from Jitsu's own tracker show two more such codes and
nineteen-character numbers: `SCD` then sixteen digits, or `SCD`, four digits, a letter and
eleven digits. Jitsu publishes neither layout, and the `SCD` numbers may be one shipper's own,
so no rule claims them.

## Links

Jitsu's recipient app opens a parcel at `recipient.gojitsu.com/{code}`, and its tracker at
`tracking.gojitsu.com/{code}`. The former AxleHire hosts `recipient.axlehire.com` and
`tracking.axlehire.com` forward there, and the library reads the number from all four.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
