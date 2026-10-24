# FAR International

FAR International parcels use enabled universal providers. There is no dedicated adapter.

FAR International is 泛远国际, a Hangzhou cross-border forwarder whose site is far800.com, with
end-to-end lines to the Americas and Europe. Universal providers name it FAR International.

## Numbers

Its waybills are FAR, two letters, ten digits and YQ, the layout of forwarders on the Hualei
(华磊) platform, who open their waybills with their own code, as [GZYL](../gzyl/README.md) does.
FAR's own tracker answers such a number with its history, and
[Ship24's FAR International page](https://www.ship24.com/couriers/far-tracking) describes the same
layout with a placeholder example. No other carrier's rule takes the FAR code, so
`far-international-1` has high confidence.

## Links

`www.far800.com/logistics/result?key=` followed by the number opens a parcel.

## Adapter lead

The tracker page is `GET https://www.far800.com/logistics/result?key=<number>`, server-rendered
HTML without a cookie, key or CAPTCHA. It shows the tracking and last-mile numbers, a status and
the scans, each with the offset of its clock. A number it does not know shows an empty list.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
