# Estes Forwarding Worldwide

Estes Forwarding Worldwide parcels use enabled universal providers. There is no dedicated
adapter.

Estes Forwarding Worldwide (EFW) is the Estes group's forwarding and home-delivery company:
air, ground and expedited freight, plus threshold and white-glove deliveries of large retail
items through its own terminals. It is separate from Estes Express Lines, the LTL carrier with
its own entry.

## Numbers

The tracker takes EFW's housebill number, seven digits in the archived lookups, and longer
retailer or partner references. Bare digit runs are shared by many carriers, so no rule claims
them.

## Links

The tracking site opens `efwtrack.com/track/{number}`, optionally followed by the delivery
ZIP code; `efwnow.com` takes the number in `txtInputNo` on its tracking and My EFW pages. The
library reads the number from those addresses.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
