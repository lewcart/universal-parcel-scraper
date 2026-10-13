# CJ Logistics

CJ Logistics parcels use enabled universal providers. There is no dedicated adapter.

CJ Logistics (CJ대한통운) runs South Korea's largest domestic parcel network.

## Numbers

The waybill (운송장번호) is a bare twelve-digit number; the tracker also takes ten digits. The
last digit is not a mod-7 check as with other Korean carriers, and bare twelve-digit numbers
are printed by many carriers, so no rule claims them.

## Links

The tracker on `www.cjlogistics.com/ko/tool/parcel/tracking` and `newTracking` takes the number
in `gnbInvcNo`. The former tracker on `doortodoor.co.kr` used `/parcel/doortodoor.do` with
the number in `invc_no`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
