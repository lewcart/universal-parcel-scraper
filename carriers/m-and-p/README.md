# M&P

M&P parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

M&P consignment numbers seen in archived lookups on its tracker are fifteen or twelve digits,
and a customer review gives a twelve-digit tracking ID. Digit runs of these lengths are printed
by many carriers and no known prefix or check digit sets M&P apart, so no rule claims them; a
caller names the carrier or pastes a tracking page link.

## Links

The search boxes on mulphilog.com open one consignment at `/tracking/` followed by the number.
The library reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
