# XDE Logistics

XDE Logistics parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

XDE tracker lookups show numbers made of X and ten digits, and its tracking API answered for a
number made of XSO and twelve digits. Both shapes come from too few samples to claim, so there
is no detection rule and a number is only matched to XDE when the user or a provider names the
carrier.

## Links

The library reads a number from the `tn` query parameter on the home page of `www.xde.com.ph`
and `xde.com.ph`, and from the `trackingnumber` query parameter of `/tracking.html` on
`xdelogistics.com` and `www.xdelogistics.com`, the address of the former tracker.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
