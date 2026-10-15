# TIKI

TIKI parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

TIKI prints a twelve-digit resi, and a shipment of several pieces adds a piece suffix on the
tracker. Many Indonesian carriers print twelve digits, so there is no detection rule and a
number is only matched to TIKI when the user or a provider names the carrier.

## Links

The library reads a number from `/id/track/<number>` on `tiki.id`, the address the tracker used
to fill its search form. The current tracker posts the form behind a reCAPTCHA, so there is no
lookup address to open.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
