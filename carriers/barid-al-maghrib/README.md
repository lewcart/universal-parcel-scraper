# Barid Al-Maghrib

Barid Al-Maghrib parcels, including its Amana parcel service, use enabled universal providers.
There is no dedicated adapter.

## Numbers

Barid Al-Maghrib prints UPU S10 numbers ending in `MA`. Customers quote items starting `RR`
and `LD`, and Amana parcels starting `CP`. Generic postal detection handles S10 numbers, so
Barid Al-Maghrib has no rule of its own.

## Links

The tracking page on barid.ma sends a single number to
`/bamb2cstorefront/fr/tracking/getdetailentrytracking?code={number}`, which opens one parcel.
The former tracker at bam-tracking.barid.ma took the number as `trackingCode` on
`/Tracking/index`; that host no longer answers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
