# Lotte Global Logistics

Lotte Global Logistics parcels use enabled universal providers. There is no dedicated adapter.

Lotte Global Logistics (롯데글로벌로지스) runs the South Korean parcel service 롯데택배.

## Numbers

The waybill (운송장번호) is a bare twelve-digit number whose last digit is the rest modulo 7;
the tracker's own script checks it. Yamato, Sagawa, Japan Post and other Korean carriers use
the same check on twelve digits, so no rule claims these numbers.

## Links

`www.lotteglogis.com/open/tracking` takes the number in `invno` and posts it on to the
tracker. The tracker's link view on `/home/reservation/tracking/linkView` and its mobile twin
take it in `InvNo`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
