# SMSA Express

SMSA Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

SMSA airway bills are twelve digits. Archived lookups on its trackers show them starting
`231`, `210`, `290`, `222`, `215`, `217` and `219`. No rule claims them: twelve-digit runs are
printed by many carriers, and the prefixes are not documented.

## Links

The current tracker takes numbers in a form posted to the home page and shows them at
`smsaexpress.com/sa/trackingdetails`, whose address carries them as `tracknumbers` or
`tracknumbers[0]`, under language or country paths as well. The earlier tracker read them from
`tracknumbers` on `Track.aspx` and `arabic/TrackAr.aspx`. Whether the current page opens a
number without the form is unknown, so no address is used to open one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
