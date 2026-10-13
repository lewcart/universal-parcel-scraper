# South African Post Office

South African Post Office parcels use enabled universal providers. There is no dedicated
adapter.

## Numbers

The Post Office numbers its items in the UPU S10 layout ending `ZA`, domestic parcels included,
and generic postal detection offers them. Archived lookups on its trackers show parcel,
registered and international prefixes. Inbound items keep the number of the post that accepted
them. No rule claims anything.

## Links

The tracking form on `trackingnew.postoffice.co.za` sends the number as `ParcelId` to the same
page, so `trackingnew.postoffice.co.za/?ParcelId={number}` opens one parcel. The earlier
tracker on `tracking.postoffice.co.za` read it from `id` on `/TrackNTrace/TrackNTrace.aspx`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
