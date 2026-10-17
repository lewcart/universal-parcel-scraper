# PHLPost

PHLPost parcels use enabled universal providers. There is no dedicated adapter.

The Philippine Postal Corporation runs the national post of the Philippines.

## Numbers

Its items carry UPU S10 numbers ending in PH: registered letters, EMS, parcels and others.
Inbound items keep the S10 number of the post that sent them, and PHLPost's tracker shows
those too. Generic postal detection handles both, so no carrier rule claims the layout.

## Links

The tracker at tracking.phlpost.gov.ph takes up to 30 numbers, one per line, and loads their
histories with a POST request. Lookups saved from it carry the numbers in the `TrackingNos`
parameter, and the library reads a number from that address, but opening it shows only the
empty form, so no address opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
