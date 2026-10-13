# Anteraja

Anteraja parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Anteraja resi numbers are fourteen digits, starting `1000` in Anteraja's replies to complaints
and `1100` in more recent complaints. Fourteen digits are DPD's parcel layout and several other
carriers print them, so no rule claims them. The tracker also takes booking codes.

## Links

Anteraja's site routes `anteraja.id/tracking/{number}` to its tracker, which asks for a
CAPTCHA before it shows a parcel; the library reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
