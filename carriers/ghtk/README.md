# GHTK

Giao Hàng Tiết Kiệm (GHTK) parcels use enabled universal providers. There is no dedicated
adapter.

## Numbers

GHTK labels print a code made of `S` and the shop's number, sorting codes and the order number,
separated by dots, such as lookups archived from GHTK's tracker show. `ghtk-1` claims that
code. The tracker also takes the order number alone, nine or ten digits, which other carriers
print too, so no rule claims it.

## Links

GHTK's tracker opens one parcel at `i.ghtk.vn/{number}`, and the library reads the number from
that address. The page asks for a reCAPTCHA before it shows a parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
