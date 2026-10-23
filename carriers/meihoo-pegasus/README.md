# MeiHoo Pegasus

MeiHoo Pegasus parcels use enabled universal providers. There is no dedicated adapter yet.

MeiHoo Pegasus is a Chinese cross-border forwarder whose site is jecship.com. Universal providers
name it MeiHoo Pegasus.

## Numbers

Its waybills are MYH, nine digits and CN. A parcel a universal provider filed under MeiHoo
Pegasus has that layout, the carrier's own tracker answers it with the same scans, and no other
carrier's rule takes it, so `meihoo-pegasus-1` has high confidence.

## Links

The tracker sits on a bare address and port rather than the carrier's domain, so no link opens
one parcel.

## Why there is no adapter

The site's Waybill Tracking page opens a tracker on the Hualei (华磊) platform, the one
[GZYL](../gzyl/README.md) and other forwarders use. It answers in GBK and dates scans on Beijing
time, and its place-bearing wordings are not yet mapped, so MeiHoo Pegasus stays on universal
providers until an adapter reads it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
