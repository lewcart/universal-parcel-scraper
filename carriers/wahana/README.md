# Wahana Express

Wahana Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Wahana Express prints an eight-character resi of digits and capital letters in random order, as
its FAQ describes. The shape is too generic for a detection rule, so a number is only matched
to Wahana when the user or a provider names the carrier.

## Links

The tracker reads one or more numbers, separated by spaces, from the `noresi` query parameter
of `/lacak-kiriman` on `www.wahana.com` and `wahana.com`. Its search form now opens a CAPTCHA
before it shows a result.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
