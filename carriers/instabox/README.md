# Instabox

Instabox parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Instabox parcel IDs looked up through its former tracking API are two letters and ten or twelve
digits, the digits starting `01` or `02`; the letters vary between parcels. Two letters and ten
digits are already shapes of Amazon, J&T, Relais Colis and Colis Privé numbers, so no rule
claims the layout and the user picks Instabox.

## Links

Instabox's tracker at `track.instabox.com` asks for the parcel ID together with the recipient's
email address or phone number, so no link opens one parcel. Archived lookups went to a tracking
API on `tracking-api.instabox.se`, a host that no longer resolves.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
