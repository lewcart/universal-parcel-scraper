# Econt

Econt parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Econt's tracker takes the shipment number. Lookups archived from it since 2014 show thirteen
digits, most starting `105` and others `1080`, `1502`, `2050`, `2400` or `5600`; some of these
series end in a GS1 check digit and others do not. Thirteen digits are shared by several
carriers, so no rule claims them and the user picks Econt.

## Links

Econt's site opens one shipment at `www.econt.com/services/track-shipment/{number}`, the
address its own search box navigates to (`/en/services/track-shipment/{number}` in English),
and shows the result from `www.econt.com/trace/` in a frame. Lookups archived from the former
site put the number in `/tracking/{number}/` or as `num` on `/tracking/`, an address that now
redirects to the current tracker.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
