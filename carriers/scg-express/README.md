# SCG Express

SCG Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Archived lookups on SCG Express's tracker show twelve-digit numbers that start `1100` and end
in the mod 7 check digit that Yamato numbers also use; SCG Express began as a joint venture
with Yamato. A low-confidence rule takes that family, alongside the other carriers that accept
twelve digits. The tracker also takes order ids and phone numbers, which are not parcel
numbers.

## Links

scgexpress.co.th opens one parcel at `/tracking/detail/{number}/`, which redirects to its
search page with the number encoded in the `tracking_search` parameter. The tracker keeps two
months of history.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
