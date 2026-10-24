# YWE

YWE is YanwenExpress, a US last-mile network for parcels flown in from China, whose site is
yanwenexpress.com. Universal providers name it YWE. Its parcels use enabled universal providers;
there is no dedicated adapter.

## Numbers

Its labels carry YWE and fourteen digits. A lookup on YWE's own tracker, archived by the Wayback
Machine, shows a parcel's US history under such a number. A parcel the app tracked had the same
layout, YWE's tracker answered it and a universal provider filed it under YWE. No other carrier's
rule takes the layout, so `ywe-1` has high confidence. Colis Privé's twelve characters and a
postcode would fit it, so its rule leaves the layout out. Yanwen's own tracker did not know the
archived number; Yanwen's US last-mile numbers of `YW`, a hub code and twelve digits stay with
[Yanwen](../yanwen/README.md).

## Retrieval

The tracking page asks `GET https://www.yanwenexpress.com/server?label=<number>` without a cookie,
key or CAPTCHA. The JSON reply is a list with the parcel's `expressCode` and its events, each with
epoch milliseconds, a `timeZone` offset, a place and a category. An adapter could read it; until
then universal providers track the carrier.

## Links

`www.yanwenexpress.com/tracking.html?label=` followed by the number opens a parcel.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
